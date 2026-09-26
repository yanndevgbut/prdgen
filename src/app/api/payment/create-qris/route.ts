import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPakasirQRIS } from "@/lib/payment/pakasir";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const createQrisSchema = z.object({
  plan: z.enum(["basic", "vip", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan masuk terlebih dahulu untuk membeli paket." },
        { status: 401 }
      );
    }

    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(session.user.id || ip, "create_qris", 6, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan transaksi. Silakan tunggu ${rateLimit.resetSeconds} detik.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = createQrisSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { plan, billingCycle } = validation.data;
    const adminSupabase = createAdminClient();

    // 1. Ambil harga paket terkini dari database
    const { data: pricingData } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "pricing_plans")
      .single();

    const pricing = {
      basic_monthly: 99000,
      basic_yearly: 79000,
      vip_monthly: 249000,
      vip_yearly: 199000,
      enterprise_monthly: 799000,
      enterprise_yearly: 639000,
      yearly_discount_pct: 20,
      ...(pricingData?.value as any || {}),
    };

    let finalAmount = Number(pricing.basic_monthly) || 99000;
    if (billingCycle === "yearly") {
      if (plan === "basic") {
        finalAmount = Number(pricing.basic_yearly) || Math.round((Number(pricing.basic_monthly) || 99000) * (1 - pricing.yearly_discount_pct / 100));
      } else if (plan === "vip") {
        finalAmount = Number(pricing.vip_yearly) || Math.round((Number(pricing.vip_monthly) || 249000) * (1 - pricing.yearly_discount_pct / 100));
      } else if (plan === "enterprise") {
        finalAmount = Number(pricing.enterprise_yearly) || Math.round((Number(pricing.enterprise_monthly) || 799000) * (1 - pricing.yearly_discount_pct / 100));
      }
    } else {
      if (plan === "basic") finalAmount = Number(pricing.basic_monthly) || 99000;
      if (plan === "vip") finalAmount = Number(pricing.vip_monthly) || 249000;
      if (plan === "enterprise") finalAmount = Number(pricing.enterprise_monthly) || 799000;
    }

    // 2. Buat ID order unik berformat PRD-[TIMESTAMP]-[RANDOM]
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = `PRD-${dateStr}-${randomSuffix}`;

    // 3. Panggil API Pakasir v2 untuk membuat transaksi QRIS
    const pakasirRes = await createPakasirQRIS({
      orderId,
      amount: finalAmount,
    });

    // 4. Simpan transaksi ke database Supabase
    const { data: transactionRecord, error: dbError } = await adminSupabase
      .from("transactions")
      .insert({
        order_id: orderId,
        user_id: session.user.id,
        plan: plan,
        billing_cycle: billingCycle,
        amount: finalAmount,
        fee: pakasirRes.fee || 0,
        total_payment: pakasirRes.total_payment || finalAmount,
        payment_method: "qris",
        qr_string: pakasirRes.qr_string,
        txn_id: pakasirRes.txn_id,
        status: "pending",
        expired_at: pakasirRes.expired_at,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database transaction insert error:", dbError);
    }

    // 5. Catat log aktivitas
    await adminSupabase.from("activity_logs").insert({
      user_id: session.user.id,
      action: "CREATE_QRIS_TRANSACTION",
      details: {
        order_id: orderId,
        plan,
        amount: finalAmount,
        total_payment: pakasirRes.total_payment,
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        orderId: orderId,
        txnId: pakasirRes.txn_id,
        plan: plan,
        billingCycle: billingCycle,
        amount: finalAmount,
        fee: pakasirRes.fee,
        totalPayment: pakasirRes.total_payment,
        qrString: pakasirRes.qr_string,
        expiredAt: pakasirRes.expired_at,
      },
    });
  } catch (err: any) {
    console.error("Create QRIS API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal membuat transaksi QRIS." },
      { status: 500 }
    );
  }
}
