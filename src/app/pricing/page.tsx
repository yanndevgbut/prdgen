import { createClient } from "@/lib/supabase/server";
import {
  FALLBACK_PRICING_PLANS,
  type PricingPlans,
} from "@/lib/pricing";
import { PricingClient } from "./pricing-client";

export const dynamic = "force-dynamic";

function normalizePricing(value: unknown): PricingPlans {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const pricing = { ...FALLBACK_PRICING_PLANS };

  for (const key of Object.keys(pricing) as Array<keyof PricingPlans>) {
    const candidate = raw[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      pricing[key] = candidate;
    }
  }

  return pricing;
}

export default async function PricingPage() {
  let initialPricing = FALLBACK_PRICING_PLANS;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pricing_plans")
      .single();

    if (error) throw error;
    if (data?.value) {
      initialPricing = normalizePricing(data.value);
    }
  } catch (error) {
    console.error("Gagal memuat pricing_plans dari database:", error);
  }

  return <PricingClient initialPricing={initialPricing} />;
}
