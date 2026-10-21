import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlan } from "@/lib/plan";
import {
  FALLBACK_PRICING_PLANS,
  getPlanBasePrice,
  type PricingPlans,
} from "@/lib/pricing";

interface TransactionPriceFields {
  plan: string;
  billing_cycle?: string | null;
  amount: number | string;
}

/**
 * Memastikan nominal transaksi minimal sebesar harga paket yang berlaku.
 * Ini mencegah transaksi palsu dengan plan mahal tetapi nominal murah
 * (mis. plan enterprise dengan amount basic) sebelum RLS migration diterapkan.
 *
 * Nominal lebih besar tetap diizinkan agar transaksi lama yang dibuat sebelum
 * harga berubah tidak ikut tertahan.
 */
export async function isTransactionPriceValid(
  transaction: TransactionPriceFields
): Promise<boolean> {
  const plan = normalizePlan(transaction.plan);
  if (plan === "trial") return false;

  const billingCycle =
    transaction.billing_cycle === "yearly" ? "yearly" : "monthly";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "pricing_plans")
    .maybeSingle();

  const pricing: PricingPlans = {
    ...FALLBACK_PRICING_PLANS,
    ...((data?.value as Partial<PricingPlans>) || {}),
  };

  const expectedAmount = getPlanBasePrice(pricing, plan, billingCycle);
  return Number(transaction.amount) >= expectedAmount;
}
