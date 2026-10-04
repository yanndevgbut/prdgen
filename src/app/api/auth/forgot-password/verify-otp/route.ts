import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { decryptSecret } from "@/lib/security/crypto";
import { z } from "zod";

const verifyResetOtpSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  otpCode: z.string().length(6, "Kode OTP harus 6 digit angka"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting per IP (Maks 10 percobaan per 5 menit)
    const rateLimit = await checkRateLimit(ip, "verify_reset_otp", 10, 5 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan. Silakan tunggu ${rateLimit.resetSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = verifyResetOtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, otpCode } = validation.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();
    const adminSupabase = createAdminClient();

    // 2. Ambil record OTP reset dari database
    const { data: record, error: fetchError } = await adminSupabase
      .from("password_reset_otps")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "Kode verifikasi tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 3. Cek batas percobaan salah input (Anti-Brute Force)
    if (record.attempts >= 5) {
      await adminSupabase.from("password_reset_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Batas percobaan kode OTP terlampaui (maksimal 5 kali). Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 4. Cek masa berlaku OTP (10 menit)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await adminSupabase.from("password_reset_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 5. Validasi kesesuaian kode OTP
    if (record.otp_code !== cleanOtp) {
      await adminSupabase
        .from("password_reset_otps")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      const sisaPercobaan = 5 - (record.attempts + 1);
      return NextResponse.json(
        { error: `Kode OTP salah. Sisa percobaan: ${sisaPercobaan} kali.` },
        { status: 400 }
      );
    }

    // 6. OTP Valid: Dekripsi password baru lalu update
    if (!record.encrypted_new_password) {
      return NextResponse.json(
        { error: "Password baru tidak ditemukan. Silakan minta kode reset baru." },
        { status: 400 }
      );
    }

    let newPassword: string;
    try {
      newPassword = decryptSecret(record.encrypted_new_password)
    } catch (decryptErr: any) {
      console.error("Gagal mendekripsi password reset:", decryptErr?.message);
      return NextResponse.json(
        { error: "Gagal memproses reset kata sandi. Silakan minta kode baru." },
        { status: 500 }
      );
    }

    // Cari userId di auth.users (via profiles untuk menghindari listUsers)
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Akun pengguna tidak ditemukan di auth server." },
        { status: 404 }
      );
    }

    const { error: updateAuthErr } = await adminSupabase.auth.admin.updateUserById(
      profile.id,
      {
        password: newPassword,
        email_confirm: true,
      }
    );

    if (updateAuthErr) {
      throw updateAuthErr;
    }

    // 7. Bersihkan record OTP
    await adminSupabase.from("password_reset_otps").delete().eq("email", cleanEmail);

    // 8. Catat activity log
    await adminSupabase.from("activity_logs").insert({
      user_id: profile.id,
      action: "PASSWORD_RESET_COMPLETED",
      details: {
        email: cleanEmail,
        ip: ip,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kata sandi akun Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru.",
    });
  } catch (err: any) {
    console.error("API Verify Reset OTP Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengatur ulang kata sandi." },
      { status: 500 }
    );
  }
}