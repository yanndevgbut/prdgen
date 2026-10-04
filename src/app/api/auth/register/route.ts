import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { decryptSecret } from "@/lib/security/crypto";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  otpCode: z.string().length(6, "Kode OTP harus 6 digit angka"),
  turnstileToken: z.string().min(1, "Verifikasi keamanan belum dilakukan"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate limiting pembatasan pendaftaran akun per IP (Maks 3 akun per 24 jam per IP)
    const rateLimit = await checkRateLimit(ip, "register_ip", 3, 24 * 60 * 60);
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

    const { email, otpCode, turnstileToken } = validation.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();
    const adminSupabase = createAdminClient();

    // 2. Verifikasi Cloudflare Turnstile
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.success) {
      return NextResponse.json(
        { error: turnstile.reason || "Verifikasi keamanan gagal. Silakan coba lagi." },
        { status: 403 }
      );
    }

    // 3. Cek apakah pendaftaran dibuka oleh admin di sistem
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

    // 4. Ambil record OTP dari database
    const { data: record, error: fetchError } = await adminSupabase
      .from("email_otps")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "Kode verifikasi tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 5. Cek batas percobaan salah input
    if (record.attempts >= 5) {
      await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Batas percobaan kode OTP terlampaui. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 6. Cek masa berlaku OTP
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 7. Validasi kesesuaian kode OTP
    if (record.otp_code !== cleanOtp) {
      await adminSupabase
        .from("email_otps")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      const sisaPercobaan = 5 - (record.attempts + 1);
      return NextResponse.json(
        { error: `Kode OTP salah. Sisa percobaan: ${sisaPercobaan} kali.` },
        { status: 400 }
      );
    }

    // 8. Dekripsi password lalu buat/update akun
    let decryptedPassword: string;
    try {
      decryptedPassword = decryptSecret(record.password_hash)
    } catch (decryptErr: any) {
      console.error("Gagal mendekripsi password OTP:", decryptErr?.message);
      return NextResponse.json(
        { error: "Gagal memproses pendaftaran. Silakan minta kode baru." },
        { status: 500 }
      );
    }

    let createdUser = null;

    // Gunakan user_id dari record (tidak perlu listUsers)
    if (record.user_id) {
      const { data: updatedAuth, error: updateAuthErr } =
        await adminSupabase.auth.admin.updateUserById(record.user_id, {
          password: decryptedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: record.full_name,
            plan: record.plan,
          },
        });

      if (updateAuthErr) {
        throw updateAuthErr;
      }
      createdUser = updatedAuth.user;

      // Update juga profiles
      await adminSupabase
        .from("profiles")
        .update({
          full_name: record.full_name,
          plan: record.plan,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.user_id);
    } else {
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: decryptedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: record.full_name,
          plan: record.plan,
        },
      });

      if (authError) {
        throw authError;
      }
      createdUser = authData?.user;
    }

    // 9. Bersihkan data OTP
    await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);

    // 10. Catat activity log
    if (createdUser) {
      await adminSupabase.from("activity_logs").insert({
        user_id: createdUser.id,
        action: "USER_REGISTER_VERIFIED",
        details: {
          email: cleanEmail,
          plan: record.plan,
          ip: ip,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Akun berhasil dibuat dan terverifikasi.",
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error("API Register Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mendaftarkan akun." },
      { status: 500 }
    );
  }
}