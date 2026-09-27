import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const validateCouponSchema = z.object({
  code: z.string().min(1, "Kode kupon wajib diisi"),
  plan: z.enum(["basic", "vip", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateCouponSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { code, plan, billingCycle } = validation.data;
    const cleanCode = code.trim().toUpperCase();
    const adminSupabase = createAdminClient();

    // 1. Ambil data kupon dari database
    const { data: coupon, error: couponError } = await adminSupabase
      .from("discount_coupons")
      .select("*")
      .eq("code", cleanCode)
      .maybeSingle();

    if (couponError || !coupon) {
      return NextResponse.json(
        { error: `Kupon "${cleanCode}" tidak ditemukan atau tidak valid.` },
        { status: 404 }
      );
    }

    if (!coupon.is_active) {
      return NextResponse.json(
        { error: `Kupon "${cleanCode}" saat ini sedang dinonaktifkan.` },
        { status: 400 }
      );
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json(
        { error: `Kuota pemakaian kupon "${cleanCode}" telah habis.` },
        { status: 400 }
      );
    }

    if (coupon.valid_until && new Date(coupon.valid_until).getTime() < Date.now()) {
      return NextResponse.json(
        { error: `Masa berlaku kupon "${cleanCode}" telah kedaluwarsa.` },
        { status: 400 }
      );
    }

    // 2. Hitung harga paket dasar
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

    // 3. Hitung potongan diskon
    const discountAmount = Math.round((baseAmount * Number(coupon.percentage)) / 100);
    const finalAmount = Math.max(500, baseAmount - discountAmount); // Pakasir min 500

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        percentage: coupon.percentage,
      },
      baseAmount,
      discountAmount,
      finalAmount,
      message: `Kupon ${coupon.code} berhasil diterapkan! Diskon ${coupon.percentage}%.`,
    });
  } catch (err: any) {
    console.error("Validate Coupon Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memvalidasi kode kupon." },
      { status: 500 }
    );
  }
}
