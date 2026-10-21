export type PricingPlans = {
  basic_monthly: number;
  basic_yearly: number;
  vip_monthly: number;
  vip_yearly: number;
  enterprise_monthly: number;
  enterprise_yearly: number;
  yearly_discount_pct: number;
};

// Fallback hanya dipakai jika pricing_plans gagal dibaca dari database.
export const FALLBACK_PRICING_PLANS: PricingPlans = {
  basic_monthly: 10000,
  basic_yearly: 20000,
  vip_monthly: 20000,
  vip_yearly: 30000,
  enterprise_monthly: 50000,
  enterprise_yearly: 60000,
  yearly_discount_pct: 20,
};
