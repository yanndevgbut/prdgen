import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlan, type PlanName } from "@/lib/plan";

export interface ActivatePlanResult {
  plan: PlanName;
  expiresAt: string | null;
  legacy: boolean;
}

function addBillingCycle(date: Date, billingCycle: string): Date {
  const next = new Date(date);
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Mengaktifkan plan berbayar dan menghitung masa aktif.
 *
 * Jika kolom plan_expires_at belum ada (migration belum dijalankan), fungsi
 * tetap menyimpan plan agar pembayaran tidak gagal. Setelah migration
 * dijalankan, expiry akan otomatis dipakai.
 */
export async function activatePlan(params: {
  userId: string;
  plan: string;
  billingCycle: string;
  paidAt?: string | null;
}): Promise<ActivatePlanResult> {
  const plan = normalizePlan(params.plan);
  if (plan === "trial") {
    return { plan, expiresAt: null, legacy: false };
  }

  const supabase = createAdminClient();
  const paidAt = params.paidAt ? new Date(params.paidAt) : new Date();
  const paidAtMs = Number.isFinite(paidAt.getTime()) ? paidAt.getTime() : Date.now();
  let startsAt = new Date(Math.max(Date.now(), paidAtMs));

  // Perpanjang dari expiry yang masih aktif jika user membeli plan yang sama.
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", params.userId)
    .maybeSingle();

  if (
    currentProfile &&
    normalizePlan(currentProfile.plan) === plan &&
    typeof currentProfile.plan_expires_at === "string"
  ) {
    const currentExpiry = new Date(currentProfile.plan_expires_at);
    if (
      Number.isFinite(currentExpiry.getTime()) &&
      currentExpiry.getTime() > startsAt.getTime()
    ) {
      startsAt = currentExpiry;
    }
  }

  const expiresAt = addBillingCycle(startsAt, params.billingCycle).toISOString();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      plan_expires_at: expiresAt,
      updated_at: updatedAt,
    })
    .eq("id", params.userId);

  if (!error) {
    return { plan, expiresAt, legacy: false };
  }

  const isMissingExpiryColumn =
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /plan_expires_at/i.test(error.message);

  if (!isMissingExpiryColumn) {
    throw error;
  }

  const { error: fallbackError } = await supabase
    .from("profiles")
    .update({
      plan,
      updated_at: updatedAt,
    })
    .eq("id", params.userId);

  if (fallbackError) throw fallbackError;

  return { plan, expiresAt: null, legacy: true };
}
