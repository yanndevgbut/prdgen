import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting: Maksimal 3 permintaan reset per 10 menit per IP
    const rateLimit = checkRateLimit(ip, "forgot_pwd_send", 3, 10 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan reset kata sandi. Silakan tunggu ${rateLimit.resetSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const cleanEmail = validation.data.email.trim().toLowerCase();
    const adminSupabase = createAdminClient();

    // 2. Cek apakah email terdaftar di profiles / auth
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id, full_name, status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Alamat email ini tidak terdaftar di sistem kami." },
        { status: 404 }
      );
    }

    if (profile.status === "banned") {
      return NextResponse.json(
        { error: "Akun ini telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    // 3. Generate 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit

    // 4. Bersihkan OTP lama untuk email ini lalu simpan yang baru
    await adminSupabase.from("password_reset_otps").delete().eq("email", cleanEmail);

    const { error: insertError } = await adminSupabase.from("password_reset_otps").insert({
      email: cleanEmail,
      otp_code: otpCode,
      attempts: 0,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Gagal menyimpan OTP reset ke database:", insertError);
      throw new Error("Gagal memproses kode reset kata sandi.");
    }

    // 5. Kirim email nyata berisi kode OTP reset kata sandi via Resend
    const emailResult = await sendPasswordResetEmail({
      email: cleanEmail,
      fullName: profile.full_name || undefined,
      otpCode: otpCode,
    });

    if (!emailResult.success && process.env.NODE_ENV === "production") {
      throw new Error(emailResult.error || "Gagal mengirimkan email reset kata sandi.");
    }

    // 6. Catat log
    await adminSupabase.from("activity_logs").insert({
      action: "SEND_PASSWORD_RESET_OTP",
      details: {
        email: cleanEmail,
        ip: ip,
        resend_email_id: emailResult.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Kode OTP 6-digit untuk reset kata sandi telah dikirimkan ke ${cleanEmail}.`,
      devOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (err: any) {
    console.error("API Forgot Password Send OTP Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengirimkan kode OTP reset kata sandi." },
      { status: 500 }
    );
  }
}
