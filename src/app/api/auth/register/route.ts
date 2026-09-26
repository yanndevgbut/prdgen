import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
  plan: z.enum(["trial", "basic", "vip", "enterprise"]).default("trial"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate limiting pembatasan pendaftaran akun per IP (Maks 3 akun per 24 jam per IP)
    const rateLimit = checkRateLimit(ip, "register_ip", 3, 24 * 60 * 60);
    if (!rateLimit.allowed) {
      const hoursLeft = Math.ceil(rateLimit.resetSeconds / 3600);
      return NextResponse.json(
        {
          error: `Terlalu banyak pendaftaran dari alamat IP ini. Silakan coba lagi dalam ${hoursLeft} jam.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { fullName, email, password, plan } = validation.data;
    const adminSupabase = createAdminClient();

    // 2. Cek apakah pendaftaran dibuka oleh admin di sistem
    const { data: settingData } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "general_settings")
      .single();

    if (settingData?.value && (settingData.value as any).allow_registration === false) {
      return NextResponse.json(
        { error: "Pendaftaran pengguna baru sedang ditutup oleh administrator." },
        { status: 403 }
      );
    }

    // 3. Buat user di Supabase Auth Admin
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // Otomatis konfirmasi agar tidak muncul error "Email not confirmed"
      user_metadata: {
        full_name: fullName.trim(),
        plan: plan,
      },
    });

    if (authError) {
      // Jika email sudah terdaftar
      if (authError.message?.toLowerCase().includes("already registered") || authError.message?.toLowerCase().includes("unique")) {
        return NextResponse.json(
          { error: "Alamat email ini sudah terdaftar. Silakan masuk." },
          { status: 400 }
        );
      }
      throw authError;
    }

    // 4. Catat activity log pendaftaran
    if (authData?.user) {
      await adminSupabase.from("activity_logs").insert({
        user_id: authData.user.id,
        action: "USER_REGISTER",
        details: {
          email: email.trim(),
          plan: plan,
          ip: ip,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Akun berhasil dibuat.",
      user: authData.user,
    });
  } catch (err: any) {
    console.error("API Register Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mendaftarkan akun." },
      { status: 500 }
    );
  }
}
