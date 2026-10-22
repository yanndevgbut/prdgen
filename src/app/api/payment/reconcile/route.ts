import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus } from "@/lib/payment/pakasir";
import { isTransactionPriceValid } from "@/lib/payment/verify";
import {
  activatePlan,
  checkPlanDowngrade,
} from "@/lib/security/plan";

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
    let mismatched = 0;
    let downgradeBlocked = 0;
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
          if (!(await isTransactionPriceValid(trx))) {
            mismatched += 1;
            console.error("Reconcile transaction price mismatch:", {
              order_id: trx.order_id,
              plan: trx.plan,
              billing_cycle: trx.billing_cycle,
              amount: trx.amount,
            });
            await new Promise((r) => setTimeout(r, 4500));
            continue;
          }

          const expectedAmount = Math.max(
            0,
            Number(trx.amount) - Number(trx.discount_amount || 0)
          );
          const expectedTotal = Number(trx.total_payment);
          const upstreamAmount = Number(pakasirStatus.amount);

          if (
            (pakasirStatus.order_id && pakasirStatus.order_id !== trx.order_id) ||
            !Number.isFinite(upstreamAmount) ||
            (upstreamAmount !== expectedAmount && upstreamAmount !== expectedTotal)
          ) {
            mismatched += 1;
            console.error("Reconcile transaction mismatch:", {
              order_id: trx.order_id,
              upstream_order_id: pakasirStatus.order_id,
              amount: upstreamAmount,
              expected_amount: expectedAmount,
              expected_total: expectedTotal,
            });
            continue;
          }

          const downgrade = await checkPlanDowngrade(trx.user_id, trx.plan);

          if (downgrade.downgrade) {
            await adminSupabase
              .from("transactions")
              .update({
                status: "canceled",
                completed_at:
                  pakasirStatus.completed_at || new Date().toISOString(),
                is_sandbox: Boolean(pakasirStatus.is_sandbox),
                updated_at: new Date().toISOString(),
              })
              .eq("id", trx.id);

            await adminSupabase.from("activity_logs").insert({
              user_id: trx.user_id,
              action: "RECONCILE_PAYMENT_DOWNGRADE_BLOCKED",
              details: {
                order_id: trx.order_id,
                current_plan: downgrade.currentPlan,
                attempted_plan: trx.plan,
                total_payment: trx.total_payment,
                refund_required: true,
                source: "reconcile",
              },
            });

            downgradeBlocked += 1;
            await new Promise((r) => setTimeout(r, 4500));
            continue;
          }

          await adminSupabase
            .from("transactions")
            .update({
              status: "completed",
              completed_at: pakasirStatus.completed_at || new Date().toISOString(),
              is_sandbox: Boolean(pakasirStatus.is_sandbox),
              updated_at: new Date().toISOString(),
            })
            .eq("id", trx.id);

          const activation = await activatePlan({
            userId: trx.user_id,
            plan: trx.plan,
            billingCycle: trx.billing_cycle || "monthly",
            paidAt: pakasirStatus.completed_at,
          });

          await adminSupabase.from("activity_logs").insert({
            user_id: trx.user_id,
            action: "RECONCILE_PAYMENT_COMPLETED",
            details: {
              order_id: trx.order_id,
              plan: trx.plan,
              total_payment: trx.total_payment,
              plan_expires_at: activation.expiresAt,
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

    return NextResponse.json({
      reconciled,
      upgraded,
      mismatched,
      downgradeBlocked,
      upgradedPlan,
    });
  } catch (err: any) {
    console.error("Reconcile payment error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
