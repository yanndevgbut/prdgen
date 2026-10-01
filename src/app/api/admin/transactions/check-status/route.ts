import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus, getPakasirTransaction } from "@/lib/payment/pakasir";

async function verifyAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Forbidden", status: 403 };

  return { adminClient, userId: user.id };
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const { action, orderId, txnId } = body;

  // ============ AKSI: SINKRONKAN SEMUA TRANSAKSI PENDING ============
  if (action === "bulk_sync") {
    const { data: pendingList, error: bulkErr } = await auth.adminClient
      .from("transactions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (bulkErr || !pendingList || pendingList.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        completed: 0,
        failed: 0,
        message: "Tidak ada transaksi pending yang perlu dicek.",
      });
    }

    let completed = 0;
    let stillPending = 0;
    const failed: { order_id: string; reason: string }[] = [];

    // Jeda 4,5 detik antar cek agar tidak kena rate limit Pakasir
    for (const trx of pendingList) {
      if (trx.txn_id) {
        try {
          const pakasirStatus = await checkPakasirStatus(trx.txn_id);

          if (pakasirStatus.status === "completed") {
            await auth.adminClient
              .from("transactions")
              .update({
                status: "completed",
                completed_at: pakasirStatus.completed_at || new Date().toISOString(),
                is_sandbox: Boolean(pakasirStatus.is_sandbox),
                updated_at: new Date().toISOString(),
              })
              .eq("id", trx.id);

            await auth.adminClient
              .from("profiles")
              .update({
                plan: trx.plan,
                updated_at: new Date().toISOString(),
              })
              .eq("id", trx.user_id);

            await auth.adminClient.from("activity_logs").insert({
              user_id: auth.userId,
              action: "ADMIN_BULK_SYNC_PAYMENT",
              details: {
                order_id: trx.order_id,
                target_user_id: trx.user_id,
                plan: trx.plan,
              },
            });

            completed += 1;
          } else if (pakasirStatus.status === "canceled") {
            await auth.adminClient
              .from("transactions")
              .update({
                status: "canceled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", trx.id);
            stillPending += 1;
          } else {
            stillPending += 1;
          }
        } catch (err: any) {
          failed.push({ order_id: trx.order_id, reason: err?.message || "error tidak diketahui" });
        }

        await new Promise((r) => setTimeout(r, 4500));
      } else {
        failed.push({ order_id: trx.order_id, reason: "Transaksi tidak punya TXN ID" });
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingList.length,
      completed,
      stillPending,
      failed,
      message: `Selesai mengecek ${pendingList.length} transaksi: ${completed} lunas, ${stillPending} masih pending, ${failed.length} gagal dicek.`,
    });
  }

  // ============ AKSI: PAKSA SELESAI (MANUAL OVERRIDE) ============
  if (action === "force_complete") {
    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const { data: transaction, error: fetchErr } = await auth.adminClient
      .from("transactions")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (fetchErr || !transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    await auth.adminClient
      .from("transactions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    await auth.adminClient
      .from("profiles")
      .update({
        plan: transaction.plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.user_id);

    await auth.adminClient.from("activity_logs").insert({
      user_id: auth.userId,
      action: "ADMIN_FORCE_COMPLETE_PAYMENT",
      details: {
        order_id: orderId,
        target_user_id: transaction.user_id,
        plan: transaction.plan,
        note: "Diubah manual oleh admin tanpa konfirmasi gateway",
      },
    });

    return NextResponse.json({
      success: true,
      status: "completed",
      message: `Transaksi ${orderId} dipaksa menjadi LUNAS. Paket user di-upgrade ke ${transaction.plan.toUpperCase()}.`,
    });
  }

  if (!orderId) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  const { data: transaction, error: fetchErr } = await auth.adminClient
    .from("transactions")
    .select("*, profiles(full_name, email)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (fetchErr || !transaction) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  let finalStatus = transaction.status;
  let statusMessage = "Status saat ini: " + transaction.status;
  let upstreamRaw: any = null;

  const targetTxnId = txnId || transaction.txn_id;

  if (targetTxnId) {
    try {
      const pakasirStatus = await checkPakasirStatus(targetTxnId);
      finalStatus = pakasirStatus.status;

      // Ambil payload mentah untuk diagnostik (lihat persis respons Pakasir)
      try {
        upstreamRaw = await getPakasirTransaction(targetTxnId);
      } catch (rawErr: any) {
        upstreamRaw = { error: rawErr?.message || "Gagal ambil payload mentah" };
      }

      if (pakasirStatus.status === "completed") {
        // Update database
        await auth.adminClient
          .from("transactions")
          .update({
            status: "completed",
            completed_at: pakasirStatus.completed_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        // Upgrade user plan
        await auth.adminClient
          .from("profiles")
          .update({
            plan: transaction.plan,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.user_id);

        // Audit log
        await auth.adminClient.from("activity_logs").insert({
          user_id: auth.userId,
          action: "ADMIN_CONFIRMED_PAYMENT",
          details: {
            order_id: orderId,
            target_user_id: transaction.user_id,
            plan: transaction.plan,
          },
        });

        statusMessage = `Transaksi berhasil dikonfirmasi lunas di Pakasir! Akun user telah di-upgrade ke ${transaction.plan.toUpperCase()}.`;
      } else if (pakasirStatus.status === "canceled") {
        await auth.adminClient
          .from("transactions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        statusMessage = "Transaksi tercatat dibatalkan / kedaluwarsa di Pakasir.";
      } else {
        statusMessage = "Status di Pakasir masih pending (menunggu pembayaran).";
      }
    } catch (err: any) {
      console.warn("Check status error from Pakasir:", err.message);
      return NextResponse.json({
        success: false,
        status: transaction.status,
        message: "Gagal menghubungkan ke Pakasir Gateway: " + err.message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    status: finalStatus,
    message: statusMessage,
    upstreamRaw,
    txnId: targetTxnId,
  });
}
