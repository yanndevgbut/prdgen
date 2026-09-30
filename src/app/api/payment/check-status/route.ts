import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus } from "@/lib/payment/pakasir";

/**
 * Rate limit Pakasir: 1 request status per 4 detik per transaksi.
 * Kita thrash-guard di server agar polling user + tombol admin tidak menumpuk.
 */
const UPSTREAM_THROTTLE_MS = 4500;
const upstreamCache = new Map<
  string,
  { at: number; status: string; completedAt: string | null; isSandbox: boolean }
>();

function readCache(orderId: string) {
  const hit = upstreamCache.get(orderId);
  if (!hit) return null;
  if (Date.now() - hit.at > UPSTREAM_THROTTLE_MS) return null;
  return hit;
}

function writeCache(
  orderId: string,
  status: string,
  completedAt: string | null,
  isSandbox: boolean
) {
  upstreamCache.set(orderId, { at: Date.now(), status, completedAt, isSandbox });

  // Bersihkan cache lama agar tidak tumbuh tanpa batas
  if (upstreamCache.size > 500) {
    const now = Date.now();
    upstreamCache.forEach((val, key) => {
      if (now - val.at > 60_000) upstreamCache.delete(key);
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Cek status transaksi di database lokal terlebih dahulu
    const { data: transaction, error: dbError } = await adminSupabase
      .from("transactions")
      .select("*")
      .eq("order_id", orderId)
      .eq("user_id", session.user.id)
      .single();

    if (dbError || !transaction) {
      return NextResponse.json(
        {
          error:
            "Transaksi tidak ditemukan. Pastikan Anda login dengan akun yang sama saat pembayaran.",
        },
        { status: 404 }
      );
    }

    const isSandbox = Boolean((transaction as any).is_sandbox);

    // 2. Sudah lunas di database lokal? langsung kembalikan
    if (transaction.status === "completed") {
      return NextResponse.json({
        status: "completed",
        plan: transaction.plan,
        orderId: transaction.order_id,
        completedAt: transaction.completed_at,
        isSandbox,
        checkedAt: new Date().toISOString(),
      });
    }

    // 3. Sudah dibatalkan? tidak perlu cek upstream lagi
    if (transaction.status === "canceled") {
      return NextResponse.json({
        status: "canceled",
        plan: transaction.plan,
        orderId: transaction.order_id,
        isSandbox,
        checkedAt: new Date().toISOString(),
      });
    }

    // 4. Still pending -> cek ke Pakasir (dengan throttle per order)
    const cacheHit = readCache(orderId);
    if (cacheHit) {
      return NextResponse.json({
        status: transaction.status === "completed" ? "completed" : cacheHit.status,
        plan: transaction.plan,
        orderId: transaction.order_id,
        completedAt: cacheHit.completedAt,
        isSandbox: isSandbox || cacheHit.isSandbox,
        checkedAt: new Date().toISOString(),
        throttled: true,
      });
    }

    if (!transaction.txn_id) {
      return NextResponse.json({
        status: transaction.status,
        plan: transaction.plan,
        orderId: transaction.order_id,
        isSandbox,
        checkedAt: new Date().toISOString(),
        upstreamCode: "NO_TXN_ID",
        upstreamMessage:
          "Transaksi ini belum punya TXN ID dari Pakasir, jadi status tidak bisa dicek.",
      });
    }

    try {
      const pakasirStatus = await checkPakasirStatus(transaction.txn_id);
      const upstreamStatus = pakasirStatus?.status || transaction.status;
      const upstreamCompletedAt = pakasirStatus?.completed_at || null;
      const upstreamIsSandbox = Boolean(pakasirStatus?.is_sandbox);

      writeCache(orderId, upstreamStatus, upstreamCompletedAt, upstreamIsSandbox);

      if (upstreamStatus === "completed") {
        // Update DB + upgrade paket user
        await adminSupabase
          .from("transactions")
          .update({
            status: "completed",
            completed_at: upstreamCompletedAt || new Date().toISOString(),
            is_sandbox: upstreamIsSandbox,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        await adminSupabase
          .from("profiles")
          .update({
            plan: transaction.plan,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.user_id);

        return NextResponse.json({
          status: "completed",
          plan: transaction.plan,
          orderId: transaction.order_id,
          completedAt: upstreamCompletedAt,
          isSandbox: upstreamIsSandbox,
          checkedAt: new Date().toISOString(),
        });
      }

      if (upstreamStatus === "canceled") {
        await adminSupabase
          .from("transactions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        return NextResponse.json({
          status: "canceled",
          plan: transaction.plan,
          orderId: transaction.order_id,
          isSandbox: upstreamIsSandbox,
          checkedAt: new Date().toISOString(),
          upstreamMessage: "Transaksi dibatalkan atau sudah kedaluwarsa di Pakasir.",
        });
      }

      // Masih pending di Pakasir
      return NextResponse.json({
        status: "pending",
        plan: transaction.plan,
        orderId: transaction.order_id,
        isSandbox: upstreamIsSandbox,
        checkedAt: new Date().toISOString(),
        upstreamMessage: upstreamIsSandbox
          ? "Mode SANDBOX: pembayaran belum di simulating. Selesaikan simulasi di dashboard Pakasir."
          : "Pembayaran belum diterima di Pakasir. Pastikan QR sudah dipindai dan pembayaran berstatus Sukses.",
      });
    } catch (upstreamError: any) {
      // JANGAN ditelan: laporkan ke user agar bisa didiagnosis
      const message =
        upstreamError?.message || "Gagal menghubungi Pakasir untuk checking status.";

      return NextResponse.json({
        status: transaction.status,
        plan: transaction.plan,
        orderId: transaction.order_id,
        isSandbox,
        checkedAt: new Date().toISOString(),
        upstreamError: true,
        upstreamMessage: message,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memeriksa status pembayaran." },
      { status: 500 }
    );
  }
}
