import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDynamicPakasirConfig } from "@/lib/payment/pakasir";
import { isTransactionPriceValid } from "@/lib/payment/verify";
import { activatePlan } from "@/lib/security/plan";

export async function POST(req: NextRequest) {
  try {
    const config = await getDynamicPakasirConfig();

    // 1. Verifikasi Webhook Secret dari Header X-Secret (jika dikonfigurasi)
    const incomingSecret = req.headers.get("x-secret");
    const isProduction = process.env.NODE_ENV === "production";

    if (!config.webhookSecret) {
      // Fail closed di production: webhook tanpa secret tidak boleh dipercaya.
      if (isProduction) {
        console.error("PAKASIR webhook secret belum dikonfigurasi di production.");
        return NextResponse.json(
          { error: "Webhook secret not configured" },
          { status: 401 }
        );
      }
    } else if (incomingSecret !== config.webhookSecret) {
      console.warn("Pakasir Webhook unauthorized secret:", incomingSecret);
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const { txn_id, order_id, status, completed_at, amount, is_sandbox } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 2. Ambil data transaksi dari database
    const { data: transaction, error: fetchErr } = await adminSupabase
      .from("transactions")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (fetchErr || !transaction) {
      console.error("Transaksi tidak ditemukan untuk order_id:", order_id);
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 2b. Idempoten: kalau sudah lunas, jangan proses ulang
    if (transaction.status === "completed") {
      return NextResponse.json({ success: true, message: "Already completed" });
    }

    // 2c. Verifikasi txn_id dan amount agar transaksi tidak bisa dipalsukan.
    if (txn_id && transaction.txn_id && txn_id !== transaction.txn_id) {
      console.error(
        `Webhook txn_id tidak cocok untuk ${order_id}: webhook=${txn_id}, db=${transaction.txn_id}`
      );
      return NextResponse.json({ error: "Transaction mismatch" }, { status: 400 });
    }

    const expectedAmount = Math.max(
      0,
      Number(transaction.amount) - Number(transaction.discount_amount || 0)
    );
    const expectedTotal = Number(transaction.total_payment);

    if (amount !== undefined) {
      const incomingAmount = Number(amount);
      const amountMatches =
        Number.isFinite(incomingAmount) &&
        (incomingAmount === expectedAmount || incomingAmount === expectedTotal);

      if (!amountMatches) {
        console.error(
          `Webhook amount tidak cocok untuk ${order_id}: webhook=${amount}, expected=${expectedAmount}/${expectedTotal}`
        );
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
      }
    }

    // 3. Jika status adalah completed, perbarui transaksi & upgrade paket user
    if (status === "completed") {
      if (!(await isTransactionPriceValid(transaction))) {
        console.error("Webhook transaction price mismatch:", {
          order_id,
          plan: transaction.plan,
          billing_cycle: transaction.billing_cycle,
          amount: transaction.amount,
        });
        return NextResponse.json(
          { error: "Transaction amount does not match plan price" },
          { status: 400 }
        );
      }

      // Update status transaksi
      await adminSupabase
        .from("transactions")
        .update({
          status: "completed",
          txn_id: txn_id || transaction.txn_id,
          completed_at: completed_at || new Date().toISOString(),
          is_sandbox: is_sandbox !== undefined ? Boolean(is_sandbox) : transaction.is_sandbox,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Upgrade paket + hitung masa aktif.
      const activation = await activatePlan({
        userId: transaction.user_id,
        plan: transaction.plan,
        billingCycle: transaction.billing_cycle || "monthly",
        paidAt: completed_at || new Date().toISOString(),
      });

      // Catat activity log
      await adminSupabase.from("activity_logs").insert({
        user_id: transaction.user_id,
        action: "PAYMENT_COMPLETED_UPGRADE",
        details: {
          order_id,
          txn_id,
          plan: transaction.plan,
          total_payment: transaction.total_payment,
          plan_expires_at: activation.expiresAt,
        },
      });
    } else if (status === "canceled") {
      await adminSupabase
        .from("transactions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);
    }

    return NextResponse.json({ success: true, message: "Webhook processed successfully" });
  } catch (err: any) {
    console.error("Pakasir Webhook Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}