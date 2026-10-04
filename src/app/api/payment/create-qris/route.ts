import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPakasirQRIS } from "@/lib/payment/pakasir";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const createQrisSchema = z.object({
  plan: z.enum(["basic", "vip", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  email: z.string().email("Format email tidak valid"),
  whatsapp: z
    .string()
    .min(9, "Nomor WhatsApp minimal 9 digit")
    .max(16, "Nomor WhatsApp maksimal 16 digit")
    .regex(/^[0-9+\s-]+$/, "Nomor WhatsApp hanya boleh berisi angka"),
  couponCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan masuk terlebih dahulu untuk membeli paket." },
        { status: 401 }
      );
    }

    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(user.id || ip, "create_qris", 6, 60);
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

    const { plan, billingCycle, email, whatsapp, couponCode } = validation.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = whatsapp.replace(/\D/g, "");
    const adminSupabase = createAdminClient();

    // 1. Cek profil user di database
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("status, plan, prd_count")
      .eq("id", user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    // 2. Ambil harga paket terkini dari database
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

    let baseAmount = Number(pricing.basic_monthly) || 99000;
    if (billingCycle === "yearly") {
      if (plan === "basic") {
        baseAmount = Number(pricing.basic_yearly) || Math.round((Number(pricing.basic_monthly) || 99000) * (1 - pricing.yearly_discount_pct / 100));
      } else if (plan === "vip") {
        baseAmount = Number(pricing.vip_yearly) || Math.round((Number(pricing.vip_monthly) || 249000) * (1 - pricing.yearly_discount_pct / 100));
      } else if (plan === "enterprise") {
        baseAmount = Number(pricing.enterprise_yearly) || Math.round((Number(pricing.enterprise_monthly) || 799000) * (1 - pricing.yearly_discount_pct / 100));
      }
    } else {
      if (plan === "basic") baseAmount = Number(pricing.basic_monthly) || 99000;
      if (plan === "vip") baseAmount = Number(pricing.vip_monthly) || 249000;
      if (plan === "enterprise") baseAmount = Number(pricing.enterprise_monthly) || 799000;
    }

    // 3. Validasi & Hitung Kupon Diskon (Server-Side Calculation)
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;

    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.trim().toUpperCase();
      const { data: couponRecord } = await adminSupabase
        .from("discount_coupons")
        .select("*")
        .eq("code", cleanCode)
        .eq("is_active", true)
        .maybeSingle();

      if (
        couponRecord &&
        (!couponRecord.max_uses || couponRecord.current_uses < couponRecord.max_uses) &&
        (!couponRecord.valid_until || new Date(couponRecord.valid_until).getTime() > Date.now())
      ) {
        discountAmount = Math.round((baseAmount * Number(couponRecord.percentage)) / 100);
        appliedCouponCode = couponRecord.code;

        // Increment current_uses pada kupon
        await adminSupabase
          .from("discount_coupons")
          .update({ current_uses: (couponRecord.current_uses || 0) + 1 })
          .eq("id", couponRecord.id);
      }
    }

    const finalAmount = Math.max(500, baseAmount - discountAmount);

    // 4. Buat ID order unik berformat PRD-[TIMESTAMP]-[RANDOM]
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = `PRD-${dateStr}-${randomSuffix}`;

    // 5. Panggil API Pakasir v2 untuk membuat transaksi QRIS
    const pakasirRes = await createPakasirQRIS({
      orderId,
      amount: finalAmount,
    });

    // 6. Simpan transaksi ke database Supabase
    const { data: transactionRecord, error: dbError } = await adminSupabase
      .from("transactions")
      .insert({
        order_id: orderId,
        user_id: user.id,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
        plan: plan,
        billing_cycle: billingCycle,
        amount: baseAmount,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
        fee: pakasirRes.fee || 0,
        total_payment: pakasirRes.total_payment || finalAmount,
        payment_method: "qris",
        qr_string: pakasirRes.qr_string,
        txn_id: pakasirRes.txn_id,
        is_sandbox: Boolean(pakasirRes.is_sandbox),
        status: "pending",
        expired_at: pakasirRes.expired_at,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database transaction insert error:", dbError);
    }

    // 7. Catat log aktivitas
    await adminSupabase.from("activity_logs").insert({
      user_id: user.id,
      action: "CREATE_QRIS_TRANSACTION",
      details: {
        order_id: orderId,
        txn_id: pakasirRes.txn_id,
        plan,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
        amount: finalAmount,
        coupon_code: appliedCouponCode,
        total_payment: pakasirRes.total_payment,
        is_sandbox: Boolean(pakasirRes.is_sandbox),
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        orderId: orderId,
        txnId: pakasirRes.txn_id,
        plan: plan,
        billingCycle: billingCycle,
        customerEmail: cleanEmail,
        customerPhone: cleanPhone,
        baseAmount: baseAmount,
        discountAmount: discountAmount,
        couponCode: appliedCouponCode,
        amount: finalAmount,
        fee: pakasirRes.fee,
        totalPayment: pakasirRes.total_payment,
        qrString: pakasirRes.qr_string,
        expiredAt: pakasirRes.expired_at,
        isSandbox: Boolean(pakasirRes.is_sandbox),
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
