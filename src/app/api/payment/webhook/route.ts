import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDynamicPakasirConfig } from "@/lib/payment/pakasir";

export async function POST(req: NextRequest) {
  try {
    const config = await getDynamicPakasirConfig();

    // 1. Verifikasi Webhook Secret dari Header X-Secret (jika dikonfigurasi)
    const incomingSecret = req.headers.get("x-secret");
    if (config.webhookSecret && incomingSecret !== config.webhookSecret) {
      console.warn("Pakasir Webhook unauthorized secret:", incomingSecret);
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const body = await req.json();
    const { txn_id, order_id, status, completed_at } = body;

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

    // 3. Jika status adalah completed, perbarui transaksi & upgrade paket user
    if (status === "completed") {
      // Update status transaksi
      await adminSupabase
        .from("transactions")
        .update({
          status: "completed",
          txn_id: txn_id || transaction.txn_id,
          completed_at: completed_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Upgrade paket akun pengguna di tabel profiles
      await adminSupabase
        .from("profiles")
        .update({
          plan: transaction.plan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.user_id);

      // Catat activity log
      await adminSupabase.from("activity_logs").insert({
        user_id: transaction.user_id,
        action: "PAYMENT_COMPLETED_UPGRADE",
        details: {
          order_id,
          txn_id,
          plan: transaction.plan,
          total_payment: transaction.total_payment,
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
