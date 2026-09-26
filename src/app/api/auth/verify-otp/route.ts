import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const verifyOtpSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  otpCode: z.string().length(6, "Kode OTP harus 6 digit angka"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting per IP (Maks 10 percobaan verifikasi per 5 menit)
    const rateLimit = checkRateLimit(ip, "verify_otp", 10, 5 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan verifikasi. Silakan tunggu ${rateLimit.resetSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = verifyOtpSchema.safeParse(body);
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

    // 2. Ambil record OTP dari database
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

    // 3. Cek batas percobaan salah input (Anti-Brute Force)
    if (record.attempts >= 5) {
      await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Batas percobaan kode OTP terlampaui (maksimal 5 kali). Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 4. Cek masa berlaku OTP (10 menit)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);
      return NextResponse.json(
        { error: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // 5. Validasi kesesuaian kode OTP
    if (record.otp_code !== cleanOtp) {
      // Tambah counter attempts
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

    // 6. OTP Valid: Buat akun resmi di Supabase Auth Admin
    let createdUser = null;
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: record.password_hash,
      email_confirm: true, // Akun langsung terverifikasi
      user_metadata: {
        full_name: record.full_name,
        plan: record.plan,
      },
    });

    if (authError) {
      // Jika user sudah terlanjur ada di auth.users dari percobaan sebelumnya, update status & password
      if (
        authError.message?.toLowerCase().includes("already registered") ||
        authError.message?.toLowerCase().includes("unique") ||
        authError.message?.toLowerCase().includes("already exists")
      ) {
        const { data: userList } = await adminSupabase.auth.admin.listUsers();
        const existingUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );

        if (existingUser) {
          const { data: updatedAuth, error: updateAuthErr } =
            await adminSupabase.auth.admin.updateUserById(existingUser.id, {
              password: record.password_hash,
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

          // Update juga profiles jika ada
          await adminSupabase
            .from("profiles")
            .update({
              full_name: record.full_name,
              plan: record.plan,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingUser.id);
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    } else {
      createdUser = authData?.user;
    }

    // 7. Bersihkan data OTP setelah berhasil
    await adminSupabase.from("email_otps").delete().eq("email", cleanEmail);

    // 8. Catat activity log
    if (createdUser) {
      await adminSupabase.from("activity_logs").insert({
        user_id: createdUser.id,
        action: "USER_VERIFY_OTP_REGISTER",
        details: {
          email: cleanEmail,
          plan: record.plan,
          ip: ip,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Verifikasi OTP berhasil. Akun Anda telah aktif!",
      password: record.password_hash,
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error("API Verify OTP Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memverifikasi kode OTP." },
      { status: 500 }
    );
  }
}
