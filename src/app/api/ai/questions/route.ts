import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDynamicQuestions } from "@/lib/ai/9router";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const questionRequestSchema = z.object({
  title: z.string().min(1, "Nama produk wajib diisi"),
  description: z.string().min(5, "Deskripsi produk minimal 5 karakter"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // Rate Limiting: Maks 10 request per menit per user/IP
    const ip = getClientIp(req);
    const identifier = session.user.id || ip;
    const rateLimit = checkRateLimit(identifier, "ai_questions", 10, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan pertanyaan AI. Silakan tunggu ${rateLimit.resetSeconds} detik sebelum mencoba lagi.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = questionRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, description } = validation.data;

    // Cek apakah user berstatus banned
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("status")
      .eq("id", session.user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    // Generate tailored questions via 9router AI
    const questions = await generateDynamicQuestions({
      title,
      description,
    });

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error: any) {
    console.error("API Questions Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menghasilkan pertanyaan pendukung." },
      { status: 500 }
    );
  }
}
