export type PricingPlans = {
  basic_monthly: number;
  basic_yearly: number;
  vip_monthly: number;
  vip_yearly: number;
  enterprise_monthly: number;
  enterprise_yearly: number;
  yearly_discount_pct: number;
};

export type PaidPlan = "basic" | "vip" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export function getPlanBasePrice(
  pricing: PricingPlans,
  plan: PaidPlan,
  billingCycle: BillingCycle
): number {
  const monthlyKey = `${plan}_monthly` as keyof PricingPlans;
  const yearlyKey = `${plan}_yearly` as keyof PricingPlans;
  const fallbackMonthly = Number(FALLBACK_PRICING_PLANS[monthlyKey]);
  const monthly = Number(pricing[monthlyKey]) || fallbackMonthly;

  if (billingCycle === "monthly") {
    return monthly;
  }

  const yearly = Number(pricing[yearlyKey]);
  if (Number.isFinite(yearly) && yearly > 0) {
    return yearly;
  }

  const fallbackYearly = Number(FALLBACK_PRICING_PLANS[yearlyKey]);
  if (Number.isFinite(fallbackYearly) && fallbackYearly > 0) {
    return fallbackYearly;
  }

  const discountPct = Number(pricing.yearly_discount_pct) || 0;
  return Math.max(500, Math.round(monthly * (1 - discountPct / 100)));
}

export function getYearlyMonthlyEquivalent(yearlyPrice: number): number {
  const yearly = Number(yearlyPrice);
  if (!Number.isFinite(yearly) || yearly <= 0) return 0;
  return Math.round(yearly / 12);
}

export function getYearlySavingsPercent(
  monthlyPrice: number,
  yearlyPrice: number
): number {
  const monthly = Number(monthlyPrice);
  const yearly = Number(yearlyPrice);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  if (!Number.isFinite(yearly) || yearly <= 0) return 0;

  const fullYearPrice = monthly * 12;
  if (fullYearPrice <= 0) return 0;

  return Math.max(0, Math.round((1 - yearly / fullYearPrice) * 100));
}

// Fallback hanya dipakai jika pricing_plans gagal dibaca dari database.
export const FALLBACK_PRICING_PLANS: PricingPlans = {
  basic_monthly: 10000,
  basic_yearly: 96000,
  vip_monthly: 20000,
  vip_yearly: 192000,
  enterprise_monthly: 50000,
  enterprise_yearly: 480000,
  yearly_discount_pct: 20,
};
