import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePRDFromAI } from "@/lib/ai/9router";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { consumeCredits } from "@/lib/security/credits";
import { z } from "zod";

const generateSchema = z.object({
  title: z.string().min(1, "Nama produk wajib diisi").max(200, "Nama produk maksimal 200 karakter"),
  description: z.string().min(5, "Deskripsi produk minimal 5 karakter").max(4000, "Deskripsi produk maksimal 4000 karakter"),
  mode: z.enum(["ai", "manual"]).default("ai"),
  modelOverride: z.string().min(1).max(100).optional(),
  answers: z.record(z.any()).optional(),
  questions: z.array(z.any()).optional(),
  targetAudience: z.string().max(1000).optional(),
  techStack: z.string().max(1000).optional(),
  hosting: z.string().max(1000).optional(),
  thirdParty: z.string().max(1000).optional(),
});

const TIER_LEVELS: Record<string, number> = {
  trial: 1,
  basic: 2,
  vip: 3,
  enterprise: 4,
};

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // 1. Rate Limiting: Maksimal 5 generate request per menit per user/IP
    const ip = getClientIp(req);
    const identifier = user.id || ip;
    const rateLimit = checkRateLimit(identifier, "ai_generate", 5, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan generate PRD. Silakan tunggu ${rateLimit.resetSeconds} detik sebelum mencoba lagi.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      mode,
      modelOverride,
      answers,
      questions,
      targetAudience,
      techStack,
      hosting,
      thirdParty,
    } = validation.data;

    // 2. Cek profil user di database
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("status, plan, prd_count")
      .eq("id", user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    // 3. Validasi Model Tier Lock (Server-side Role Protection)
    if (modelOverride) {
      const { data: modelData } = await adminSupabase
        .from("ai_models")
        .select("name, min_tier")
        .eq("model_id", modelOverride)
        .eq("is_active", true)
        .single();

      // Wajib terdaftar & aktif; tolak bila tidak dikenal (cegah bypass tier)
      if (!modelData) {
        return NextResponse.json(
          { error: "Model AI yang diminta tidak ditemukan atau tidak aktif." },
          { status: 403 }
        );
      }

      const userPlanLevel = TIER_LEVELS[profile?.plan?.toLowerCase() || "trial"] || 1;
      const requiredLevel = TIER_LEVELS[modelData.min_tier?.toLowerCase() || "basic"] || 1;

      if (userPlanLevel < requiredLevel) {
        return NextResponse.json(
          {
            error: `Model AI "${modelData.name}" membutuhkan paket ${modelData.min_tier.toUpperCase()} ke atas. Silakan upgrade paket Anda untuk menggunakan model ini.`,
          },
          { status: 403 }
        );
      }
    }

    // 4. Cek & Konsumsi Kredit Harian (Reset Rolling 24 Jam)
    const creditResult = await consumeCredits(user.id, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || "Kredit harian kamu telah habis." },
        { status: 403 }
      );
    }

    // 5. Generate PRD via 9router AI Gateway
    const { contentMarkdown, taskBreakdown } = await generatePRDFromAI({
      title,
      description,
      answers,
      questions,
      targetAudience,
      techStack,
      hosting,
      thirdParty,
      modelOverride,
    });

    // 6. Simpan ke database Supabase
    const { data: newPrd, error: dbError } = await supabase
      .from("prds")
      .insert({
        user_id: user.id,
        title,
        description,
        mode,
        answers: answers || {
          targetAudience,
          techStack,
          hosting,
          thirdParty,
        },
        content_markdown: contentMarkdown,
        task_breakdown: taskBreakdown,
        status: "draft",
        version: 1.0,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      throw new Error("Gagal menyimpan dokumen PRD ke database.");
    }

    // 7. Catat activity log
    await adminSupabase.from("activity_logs").insert({
      user_id: user.id,
      action: "GENERATE_PRD",
      details: {
        prd_id: newPrd.id,
        title: newPrd.title,
        model_used: modelOverride || "default",
        remaining_credits: creditResult.remainingCredits,
      },
    });

    return NextResponse.json({
      success: true,
      prd: newPrd,
      credits: creditResult.remainingCredits,
      maxCredits: creditResult.maxCredits,
      isUnlimited: creditResult.isUnlimited,
      creditsResetAt: creditResult.resetAt,
    });
  } catch (error: any) {
    console.error("API Generate Error:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server saat generate PRD." },
      { status: 500 }
    );
  }
}
