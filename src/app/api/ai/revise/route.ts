import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revisePRDWithAI } from "@/lib/ai/9router";
import { getClientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

const reviseSchema = z.object({
  prdId: z.string().uuid("ID PRD tidak valid"),
  instruction: z.string().min(3, "Instruksi revisi minimal 3 karakter"),
  modelOverride: z.string().optional(),
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
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // 1. Rate Limiting: Maksimal 5 revisi per menit
    const ip = getClientIp(req);
    const identifier = session.user.id || ip;
    const rateLimit = checkRateLimit(identifier, "ai_revise", 5, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan revisi. Silakan tunggu ${rateLimit.resetSeconds} detik sebelum mencoba lagi.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = reviseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { prdId, instruction, modelOverride } = validation.data;
    const adminSupabase = createAdminClient();

    // 2. Cek profil user & ban status
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("status, plan")
      .eq("id", session.user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    // 3. Validasi Model Tier Lock
    if (modelOverride) {
      const { data: modelData } = await adminSupabase
        .from("ai_models")
        .select("name, min_tier")
        .eq("model_id", modelOverride)
        .eq("is_active", true)
        .single();

      if (modelData) {
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
    }

    // 4. Ambil data PRD saat ini & pastikan milik user yang login
    const { data: currentPrd, error: fetchError } = await supabase
      .from("prds")
      .select("*")
      .eq("id", prdId)
      .eq("user_id", session.user.id)
      .single();

    if (fetchError || !currentPrd) {
      return NextResponse.json(
        { error: "Dokumen PRD tidak ditemukan atau Anda tidak memiliki akses." },
        { status: 404 }
      );
    }

    // 5. Revisi via 9router AI
    const { revisedMarkdown } = await revisePRDWithAI({
      currentContent: currentPrd.content_markdown,
      revisionInstruction: instruction,
      modelOverride,
    });

    const nextVersion = parseFloat((Number(currentPrd.version) + 0.1).toFixed(1));

    // 6. Simpan riwayat revisi
    await supabase.from("prd_revisions").insert({
      prd_id: prdId,
      instruction,
      version: nextVersion,
      content_markdown: revisedMarkdown,
    });

    // 7. Update PRD di tabel utama
    const { data: updatedPrd, error: updateError } = await supabase
      .from("prds")
      .update({
        content_markdown: revisedMarkdown,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prdId)
      .select()
      .single();

    if (updateError) {
      throw new Error("Gagal memperbarui dokumen PRD di database.");
    }

    // 8. Catat log
    await adminSupabase.from("activity_logs").insert({
      user_id: session.user.id,
      action: "REVISE_PRD",
      details: {
        prd_id: prdId,
        version: nextVersion,
        model_used: modelOverride || "default",
      },
    });

    return NextResponse.json({
      success: true,
      prd: updatedPrd,
    });
  } catch (error: any) {
    console.error("API Revise Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal merevisi PRD." },
      { status: 500 }
    );
  }
}
