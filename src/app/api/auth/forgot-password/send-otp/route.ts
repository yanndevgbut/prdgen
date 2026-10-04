import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { encryptSecret } from "@/lib/security/crypto";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  turnstileToken: z.string().min(1, "Verifikasi keamanan belum dilakukan").optional(),
  isResend: z.boolean().optional(),
  newPassword: z.string().min(6, "Kata sandi baru minimal 6 karakter").max(128).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting: Maksimal 3 permintaan reset per 10 menit per IP
    const rateLimit = await checkRateLimit(ip, "forgot_pwd_send", 3, 10 * 60);
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

    // 1b. Verifikasi Cloudflare Turnstile sebelum query database & kirim email.
    //     Pada resend, widget tidak tampil di langkah 2, jadi dilewati
    //     (rate limit tetap melindungi dari spam).
    if (!validation.data.isResend) {
      const turnstile = await verifyTurnstileToken(
        validation.data.turnstileToken || "",
        ip
      );
      if (!turnstile.success) {
        return NextResponse.json(
          { error: turnstile.reason || "Verifikasi keamanan gagal. Silakan coba lagi." },
          { status: 403 }
        );
      }
    }

    // 2. Cek apakah email terdaftar di profiles / auth
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id, full_name, status")
      .eq("email", cleanEmail)
      .maybeSingle();

    // Anti user enumeration: balas generik untuk email tidak terdaftar / banned
    if (!profile || profile.status === "banned") {
      return NextResponse.json({
        success: true,
        message: "Jika email terdaftar, kode reset kata sandi akan dikirimkan.",
      });
    }

    // 3. Generate 6-digit numeric OTP code (cryptographically secure)
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit

    // 4. Bersihkan OTP lama untuk email ini lalu simpan yang baru
    await adminSupabase.from("password_reset_otps").delete().eq("email", cleanEmail);

    // Enkripsi password baru jika ada (tidak pernah plaintext di DB)
    let encryptedNewPassword: string | null = null;
    if (validation.data.newPassword) {
      encryptedNewPassword = encryptSecret(validation.data.newPassword)
    }

    const { error: insertError } = await adminSupabase.from("password_reset_otps").insert({
      email: cleanEmail,
      otp_code: otpCode,
      attempts: 0,
      expires_at: expiresAt,
      encrypted_new_password: encryptedNewPassword,
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
