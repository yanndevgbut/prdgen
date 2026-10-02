import { createAdminClient } from "@/lib/supabase/admin";

export interface PlanCreditConfig {
  trial: number;
  basic: number;
  vip: number; // 0 = Unlimited
  enterprise: number; // 0 = Unlimited
}

export const DEFAULT_CREDIT_PLANS: PlanCreditConfig = {
  trial: 3,
  basic: 10,
  vip: 0,
  enterprise: 0,
};

export interface UserCreditStatus {
  isUnlimited: boolean;
  plan: string;
  credits: number;
  maxCredits: number;
  resetAt: string | null;
  timeRemainingText: string;
}

export interface CreditConsumptionResult {
  success: boolean;
  error?: string;
  isUnlimited: boolean;
  remainingCredits: number;
  maxCredits: number;
  resetAt: string | null;
}

/**
 * Format sisa waktu menuju reset_at menjadi teks deskriptif
 * Contoh: "14 jam 20 menit" atau "45 menit" atau "1 menit"
 */
export function formatCreditResetRemaining(resetAtISO: string | null): string {
  if (!resetAtISO) return "";
  const diffMs = new Date(resetAtISO).getTime() - Date.now();
  if (diffMs <= 0) return "sebentar lagi";

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} jam ${mins} menit`;
  }
  if (hours > 0) {
    return `${hours} jam`;
  }
  return `${mins} menit`;
}

/**
 * Mengambil konfigurasi kredit harian dari system_settings
 */
export async function getPlanCreditConfigs(): Promise<PlanCreditConfig> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "credit_plans")
      .maybeSingle();

    if (data?.value) {
      return {
        ...DEFAULT_CREDIT_PLANS,
        ...(data.value as any),
      };
    }
  } catch (err) {
    console.warn("Menggunakan fallback default credit plans:", err);
  }
  return DEFAULT_CREDIT_PLANS;
}

/**
 * Memeriksa status kredit user dan melakukan reset rolling 24 jam otomatis jika waktunya tiba.
 */
export async function checkAndRefreshCredits(userId: string): Promise<UserCreditStatus> {
  const supabase = createAdminClient();
  const config = await getPlanCreditConfigs();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, status, credits, credits_reset_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error("Profil pengguna tidak ditemukan.");
  }

  const userPlan = (profile.plan || "trial").toLowerCase();
  const isUnlimited = userPlan === "vip" || userPlan === "enterprise";

  if (isUnlimited) {
    return {
      isUnlimited: true,
      plan: userPlan,
      credits: 0,
      maxCredits: 0,
      resetAt: null,
      timeRemainingText: "Unlimited",
    };
  }

  const maxCredits = userPlan === "basic" ? config.basic : config.trial;
  const now = Date.now();
  const resetAtTime = profile.credits_reset_at ? new Date(profile.credits_reset_at).getTime() : 0;

  // Jika belum pernah di-set atau sudah melewati batas waktu 24 jam -> RESET KREDIT
  if (!profile.credits_reset_at || now >= resetAtTime) {
    const nextResetDate = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("profiles")
      .update({
        credits: maxCredits,
        credits_reset_at: nextResetDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return {
      isUnlimited: false,
      plan: userPlan,
      credits: maxCredits,
      maxCredits,
      resetAt: nextResetDate,
      timeRemainingText: formatCreditResetRemaining(nextResetDate),
    };
  }

  const currentCredits = typeof profile.credits === "number" ? profile.credits : maxCredits;

  return {
    isUnlimited: false,
    plan: userPlan,
    credits: currentCredits,
    maxCredits,
    resetAt: profile.credits_reset_at,
    timeRemainingText: formatCreditResetRemaining(profile.credits_reset_at),
  };
}

/**
 * Mengonsumsi kredit pengguna (misal: 1 kredit untuk generate / 1 kredit untuk revise).
 * Menolak otomatis jika kredit habis dengan pesan error informatif.
 */
export async function consumeCredits(
  userId: string,
  cost: number = 1
): Promise<CreditConsumptionResult> {
  const status = await checkAndRefreshCredits(userId);

  if (status.isUnlimited) {
    return {
      success: true,
      isUnlimited: true,
      remainingCredits: 0,
      maxCredits: 0,
      resetAt: null,
    };
  }

  if (status.credits < cost) {
    const errorMsg = `Kredit harian (${status.plan.toUpperCase()}) kamu habis. Kredit akan di-reset otomatis dalam ${status.timeRemainingText}, atau upgrade ke paket VIP untuk akses tanpa batas.`;
    return {
      success: false,
      error: errorMsg,
      isUnlimited: false,
      remainingCredits: status.credits,
      maxCredits: status.maxCredits,
      resetAt: status.resetAt,
    };
  }

  const newCredits = Math.max(0, status.credits - cost);
  const supabase = createAdminClient();

  await supabase
    .from("profiles")
    .update({
      credits: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return {
    success: true,
    isUnlimited: false,
    remainingCredits: newCredits,
    maxCredits: status.maxCredits,
    resetAt: status.resetAt,
  };
}
