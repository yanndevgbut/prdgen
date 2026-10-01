import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter").max(128),
  turnstileToken: z.string().min(1, "Verifikasi keamanan belum dilakukan"),
});

/**
 * Login via server.
 *
 * Sekarang verifikasi happens sebelum kredensial diperiksa, sehingga bot tidak
 * bisa memakai widget Turnstile. Sesi cookie dibuat di server memakai
 * @supabase/ssr.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Rate limiting: maksimal 5 percobaan masuk per 5 menit per IP
    const rateLimit = checkRateLimit(ip, "auth_login", 5, 5 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan masuk. Silakan coba lagi dalam ${rateLimit.resetSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, turnstileToken } = validation.data;

    // 1. Verifikasi Cloudflare Turnstile terlebih dahulu
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.success) {
      return NextResponse.json(
        { error: turnstile.reason || "Verifikasi keamanan gagal. Silakan coba lagi." },
        { status: 403 }
      );
    }

    // 2. Autentikasi di server (cookie sesi ikut ter-set)
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    // Pesan generik agar tidak membocorkan apakah email terdaftar
    if (error || !data?.user) {
      return NextResponse.json(
        { error: "Email atau kata sandi salah." },
        { status: 401 }
      );
    }

    // 3. Cek status banned
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .single();

    if (profile?.status === "banned") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Akun ini telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Login Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal masuk. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
