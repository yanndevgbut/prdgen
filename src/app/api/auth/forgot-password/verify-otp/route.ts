import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const verifyResetOtpSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  otpCode: z.string().length(6, "Kode OTP harus 6 digit angka"),
  newPassword: z.string().min(6, "Kata sandi baru minimal 6 karakter"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting per IP (Maks 10 percobaan per 5 menit)
    const rateLimit = checkRateLimit(ip, "verify_reset_otp", 10, 5 * 60);
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

    const { email, otpCode, newPassword } = validation.data;
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

    // 6. OTP Valid: Cari userId di auth.users dan update kata sandi
    const { data: userList } = await adminSupabase.auth.admin.listUsers();
    const userToUpdate = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (!userToUpdate) {
      return NextResponse.json(
        { error: "Akun pengguna tidak ditemukan di auth server." },
        { status: 404 }
      );
    }

    const { error: updateAuthErr } = await adminSupabase.auth.admin.updateUserById(
      userToUpdate.id,
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
      user_id: userToUpdate.id,
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
