import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePlan, normalizePlan } from "@/lib/plan";

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

  // select("*") agar tetap kompatibel sebelum migration plan_expires_at ada.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error("Profil pengguna tidak ditemukan.");
  }

  const storedPlan = normalizePlan(profile.plan);
  const userPlan = getEffectivePlan(profile.plan, profile.plan_expires_at);

  // Best-effort: rapikan plan yang sudah kedaluwarsa menjadi trial.
  if (storedPlan !== userPlan) {
    await supabase
      .from("profiles")
      .update({
        plan: "trial",
        plan_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

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

  const supabase = createAdminClient();

  // Compare-and-swap: update hanya jika nilai credits masih sama dengan yang
  // dibaca. Dua request paralel tidak bisa sama-sama memakai kredit yang sama.
  let currentStatus = status;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (currentStatus.isUnlimited) {
      return {
        success: true,
        isUnlimited: true,
        remainingCredits: 0,
        maxCredits: 0,
        resetAt: null,
      };
    }

    if (currentStatus.credits < cost) {
      const errorMsg = `Kredit harian (${currentStatus.plan.toUpperCase()}) kamu habis. Kredit akan di-reset otomatis dalam ${currentStatus.timeRemainingText}, atau upgrade ke paket VIP untuk akses tanpa batas.`;
      return {
        success: false,
        error: errorMsg,
        isUnlimited: false,
        remainingCredits: currentStatus.credits,
        maxCredits: currentStatus.maxCredits,
        resetAt: currentStatus.resetAt,
      };
    }

    const newCredits = Math.max(0, currentStatus.credits - cost);
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits", currentStatus.credits)
      .select("credits")
      .maybeSingle();

    if (updateError) {
      console.error("Gagal mengurangi kredit:", updateError);
      break;
    }

    if (updated) {
      return {
        success: true,
        isUnlimited: false,
        remainingCredits:
          typeof updated.credits === "number" ? updated.credits : newCredits,
        maxCredits: currentStatus.maxCredits,
        resetAt: currentStatus.resetAt,
      };
    }

    // Kalah race: baca ulang status kredit lalu coba lagi.
    currentStatus = await checkAndRefreshCredits(userId);
  }

  const errorMsg = `Kredit harian (${currentStatus.plan.toUpperCase()}) kamu habis. Kredit akan di-reset otomatis dalam ${currentStatus.timeRemainingText}, atau upgrade ke paket VIP untuk akses tanpa batas.`;
  return {
    success: false,
    error: errorMsg,
    isUnlimited: false,
    remainingCredits: currentStatus.credits,
    maxCredits: currentStatus.maxCredits,
    resetAt: currentStatus.resetAt,
  };
}
