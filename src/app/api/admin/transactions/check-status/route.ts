import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus } from "@/lib/payment/pakasir";

async function verifyAdmin() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return { error: "Unauthorized", status: 401 };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Forbidden", status: 403 };

  return { adminClient, userId: session.user.id };
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orderId, txnId } = await req.json();
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

  const targetTxnId = txnId || transaction.txn_id;

  if (targetTxnId) {
    try {
      const pakasirStatus = await checkPakasirStatus(targetTxnId);
      finalStatus = pakasirStatus.status;

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
  });
}
