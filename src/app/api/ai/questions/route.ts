import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDynamicQuestions } from "@/lib/ai/9router";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { checkAndRefreshCredits } from "@/lib/security/credits";
import { getEffectivePlan } from "@/lib/plan";
import { resolveModelForPlan } from "@/lib/ai/model-access";
import { z } from "zod";

const questionRequestSchema = z.object({
  title: z.string().min(1, "Nama produk wajib diisi").max(200, "Nama produk maksimal 200 karakter"),
  description: z.string().min(5, "Deskripsi produk minimal 5 karakter").max(4000, "Deskripsi produk maksimal 4000 karakter"),
});

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

    // Rate Limiting: Maks 10 request per menit per user/IP
    const ip = getClientIp(req);
    const identifier = user.id || ip;
    const rateLimit = await checkRateLimit(identifier, "ai_questions", 10, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan pertanyaan AI. Silakan tunggu ${rateLimit.resetSeconds} detik sebelum mencoba lagi.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
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
      .select("status, plan, plan_expires_at")
      .eq("id", user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json(
        { error: "Akunmu dinonaktifkan oleh administrator. Hubungi admin untuk info lebih lanjut." },
        { status: 403 }
      );
    }

    const effectivePlan = getEffectivePlan(profile?.plan, profile?.plan_expires_at);

    // Tanya jawab gratis, tetapi tetap dibatasi per hari untuk mencegah
    // penyalahgunaan biaya AI oleh akun trial.
    const dailyLimit = await checkRateLimit(
      user.id,
      "ai_questions_daily",
      30,
      24 * 60 * 60
    );
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        {
          error: `Batas pertanyaan AI harian tercapai. Coba lagi dalam ${Math.ceil(
            dailyLimit.resetSeconds / 3600
          )} jam.`,
        },
        { status: 429 }
      );
    }

    // Refresh kredit otomatis jika sudah lewat 24 jam (Tanya jawab gratis 0 kredit)
    const creditStatus = await checkAndRefreshCredits(user.id);
    if (!creditStatus.isUnlimited && creditStatus.credits <= 0) {
      return NextResponse.json(
        {
          error: `Kredit harian (${creditStatus.plan.toUpperCase()}) kamu habis. Kredit akan di-reset otomatis dalam ${creditStatus.timeRemainingText}, atau upgrade ke paket VIP untuk akses tanpa batas.`,
        },
        { status: 403 }
      );
    }

    const modelResolution = await resolveModelForPlan(effectivePlan);
    if (!modelResolution.model) {
      return NextResponse.json(
        { error: modelResolution.error || "Model AI tidak tersedia." },
        { status: modelResolution.status || 403 }
      );
    }

    // Generate tailored questions via 9router AI
    const questions = await generateDynamicQuestions({
      title,
      description,
      modelOverride: modelResolution.model.model_id,
    });

    return NextResponse.json({
      success: true,
      questions,
      credits: creditStatus.credits,
      isUnlimited: creditStatus.isUnlimited,
      creditsResetAt: creditStatus.resetAt,
    });
  } catch (error: any) {
    console.error("API Questions Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menghasilkan pertanyaan pendukung." },
      { status: 500 }
    );
  }
}
