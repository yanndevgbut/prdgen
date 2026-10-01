import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus } from "@/lib/payment/pakasir";

/**
 * Rekonsiliasi transaksi pending milik user saat membuka workspace (/app).
 *
 * Pakasir rate limit: 1 request per 4 detik per transaksi. Karena kita hanya
 * menyentuh transaksi pending user (biasanya cuma 1), jeda 4,5 detik di sini
 * hanya sebagai pengaman bila user punya lebih dari satu transaksi pending.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 1. Cari semua transaksi pending milik user ini
    const { data: pendingList, error: fetchErr } = await adminSupabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!pendingList || pendingList.length === 0) {
      return NextResponse.json({ reconciled: 0, upgraded: 0 });
    }

    let reconciled = 0;
    let upgraded = 0;
    let upgradedPlan: string | null = null;

    for (const trx of pendingList) {
      reconciled += 1;

      if (!trx.txn_id) {
        // Tidak ada TXN ID -> tidak bisa dicek ke Pakasir
        continue;
      }

      try {
        const pakasirStatus = await checkPakasirStatus(trx.txn_id);

        if (pakasirStatus.status === "completed") {
          await adminSupabase
            .from("transactions")
            .update({
              status: "completed",
              completed_at: pakasirStatus.completed_at || new Date().toISOString(),
              is_sandbox: Boolean(pakasirStatus.is_sandbox),
              updated_at: new Date().toISOString(),
            })
            .eq("id", trx.id);

          await adminSupabase
            .from("profiles")
            .update({
              plan: trx.plan,
              updated_at: new Date().toISOString(),
            })
            .eq("id", trx.user_id);

          await adminSupabase.from("activity_logs").insert({
            user_id: trx.user_id,
            action: "RECONCILE_PAYMENT_COMPLETED",
            details: {
              order_id: trx.order_id,
              plan: trx.plan,
              total_payment: trx.total_payment,
            },
          });

          upgraded += 1;
          upgradedPlan = trx.plan;
        } else if (pakasirStatus.status === "canceled") {
          await adminSupabase
            .from("transactions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", trx.id);
        }
      } catch (err: any) {
        console.warn(`Reconcile gagal untuk ${trx.order_id}:`, err?.message);
      }

      // Jeda antar pengecekan agar tidak menabrak rate limit Pakasir
      await new Promise((r) => setTimeout(r, 4500));
    }

    return NextResponse.json({ reconciled, upgraded, upgradedPlan });
  } catch (err: any) {
    console.error("Reconcile payment error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
