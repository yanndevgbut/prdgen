export type PlanName = "trial" | "basic" | "vip" | "enterprise";

export function normalizePlan(plan: unknown): PlanName {
  const value = typeof plan === "string" ? plan.toLowerCase() : "trial";
  if (value === "basic" || value === "vip" || value === "enterprise") {
    return value;
  }
  return "trial";
}

export function isPaidPlan(plan: unknown): boolean {
  return normalizePlan(plan) !== "trial";
}

/**
 * Plan lama yang belum punya plan_expires_at tetap dianggap aktif agar migrasi
 * tidak langsung menurunkan user berbayar yang sudah ada.
 */
export function isPlanExpired(plan: unknown, expiresAt: unknown): boolean {
  if (!isPaidPlan(plan)) return false;
  if (typeof expiresAt !== "string" || !expiresAt) return false;

  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

export function getEffectivePlan(plan: unknown, expiresAt: unknown): PlanName {
  return isPlanExpired(plan, expiresAt) ? "trial" : normalizePlan(plan);
}
