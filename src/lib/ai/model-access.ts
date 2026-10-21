import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanName } from "@/lib/plan";

export const TIER_LEVELS: Record<string, number> = {
  trial: 1,
  basic: 2,
  vip: 3,
  enterprise: 4,
};

export interface ResolvedAIModel {
  model_id: string;
  name: string;
  min_tier: string;
}

export interface ModelResolution {
  model?: ResolvedAIModel;
  error?: string;
  status?: number;
}

function tierLevel(minTier: unknown): number {
  return TIER_LEVELS[String(minTier || "basic").toLowerCase()] ?? 1;
}

/**
 * Menentukan model AI yang boleh dipakai oleh paket user.
 *
 * Jika modelOverride diisi, model harus terdaftar, aktif, dan tier-nya cocok.
 * Jika tidak diisi, pilih model default yang cocok; kalau default tidak cocok,
 * pilih model termurah yang masih diizinkan. Ini mencegah user trial memakai
 * model VIP hanya karena model default di database adalah model VIP.
 */
export async function resolveModelForPlan(
  plan: PlanName,
  requestedModel?: string
): Promise<ModelResolution> {
  const supabase = createAdminClient();
  const planLevel = TIER_LEVELS[plan] ?? 1;

  if (requestedModel) {
    const { data } = await supabase
      .from("ai_models")
      .select("model_id, name, min_tier")
      .eq("model_id", requestedModel)
      .eq("is_active", true)
      .maybeSingle();

    if (!data) {
      return {
        error: "Model AI yang diminta tidak ditemukan atau tidak aktif.",
        status: 403,
      };
    }

    if (planLevel < tierLevel(data.min_tier)) {
      return {
        error: `Model AI "${data.name}" membutuhkan paket ${String(
          data.min_tier
        ).toUpperCase()} ke atas. Silakan upgrade paket Anda untuk menggunakan model ini.`,
        status: 403,
      };
    }

    return {
      model: {
        model_id: data.model_id,
        name: data.name,
        min_tier: data.min_tier,
      },
    };
  }

  const { data: models } = await supabase
    .from("ai_models")
    .select("model_id, name, min_tier, is_default, created_at")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (!models || models.length === 0) {
    return { error: "Belum ada model AI aktif yang tersedia.", status: 503 };
  }

  const allowed = models
    .filter((model: any) => tierLevel(model.min_tier) <= planLevel)
    .sort((a: any, b: any) => tierLevel(a.min_tier) - tierLevel(b.min_tier));

  const chosen = allowed.find((model: any) => model.is_default) || allowed[0];

  if (!chosen) {
    return {
      error: "Tidak ada model AI yang tersedia untuk paket Anda.",
      status: 403,
    };
  }

  return {
    model: {
      model_id: chosen.model_id,
      name: chosen.name,
      min_tier: chosen.min_tier,
    },
  };
}
