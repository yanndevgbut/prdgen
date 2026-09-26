import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { sendOTPEmail } from "@/lib/email/resend";
import { z } from "zod";

const sendOtpSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
  plan: z.enum(["trial", "basic", "vip", "enterprise"]).default("trial"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting: Maksimal 4 permintaan OTP per 10 menit per IP
    const rateLimit = checkRateLimit(ip, "send_otp", 4, 10 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan OTP. Silakan tunggu ${rateLimit.resetSeconds} detik sebelum meminta kode baru.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = sendOtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { fullName, email, password, plan } = validation.data;
    const cleanEmail = email.trim().toLowerCase();
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

    // 3. Cek apakah email sudah terdaftar di profiles / auth
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Alamat email ini sudah terdaftar. Silakan masuk ke akun Anda." },
        { status: 400 }
      );
    }

    // 4. Generate 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit

    // 5. Bersihkan OTP lama untuk email ini lalu simpan yang baru
    await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);

    const { error: insertError } = await adminSupabase.from("email_otps").insert({
      email: cleanEmail,
      otp_code: otpCode,
      full_name: fullName.trim(),
      password_hash: password, // Disimpan sementara untuk pembuatan auth setelah verifikasi
      plan: plan,
      attempts: 0,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Gagal menyimpan OTP ke database:", insertError);
      throw new Error("Gagal memproses kode verifikasi.");
    }

    // 6. Kirim email nyata berisi kode OTP menggunakan Resend SDK
    const emailResult = await sendOTPEmail({
      email: cleanEmail,
      fullName: fullName.trim(),
      otpCode: otpCode,
    });

    if (!emailResult.success && process.env.NODE_ENV === "production") {
      throw new Error(emailResult.error || "Gagal mengirimkan email verifikasi.");
    }

    // 7. Catat log
    await adminSupabase.from("activity_logs").insert({
      action: "SEND_REGISTER_OTP",
      details: {
        email: cleanEmail,
        ip: ip,
        resend_email_id: emailResult.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Kode verifikasi OTP 6-digit telah dikirimkan ke ${cleanEmail}.`,
      devOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (err: any) {
    console.error("API Send OTP Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengirimkan kode OTP." },
      { status: 500 }
    );
  }
}
