import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPakasirStatus } from "@/lib/payment/pakasir";

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
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Jika sudah completed di database lokal, langsung kembalikan status
    if (transaction.status === "completed") {
      return NextResponse.json({
        status: "completed",
        plan: transaction.plan,
        orderId: transaction.order_id,
        completedAt: transaction.completed_at,
      });
    }

    // 2. Jika masih pending, cek langsung ke Pakasir Status API
    if (transaction.txn_id) {
      try {
        const pakasirStatus = await checkPakasirStatus(transaction.txn_id);

        if (pakasirStatus.status === "completed") {
          // Update database lokal & upgrade paket
          await adminSupabase
            .from("transactions")
            .update({
              status: "completed",
              completed_at: pakasirStatus.completed_at || new Date().toISOString(),
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
            completedAt: pakasirStatus.completed_at,
          });
        }
      } catch (checkErr) {
        // Fallback to database status if Pakasir API rate limit or error
      }
    }

    return NextResponse.json({
      status: transaction.status,
      plan: transaction.plan,
      orderId: transaction.order_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memeriksa status pembayaran." },
      { status: 500 }
    );
  }
}
