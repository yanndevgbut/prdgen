"use client";

import NumberFlow from "@number-flow/react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { formatRupiah } from "@/lib/utils";
import {
  getPlanBasePrice,
  getYearlyMonthlyEquivalent,
  getYearlySavingsPercent,
  type PaidPlan,
  type PricingPlans,
} from "@/lib/pricing";
import { getPlanLevel, type PlanName } from "@/lib/plan";

interface PricingSectionProps {
  pricing: PricingPlans;
  isYearly: boolean;
  onBillingChange: (yearly: boolean) => void;
  effectivePlan: PlanName;
  onCheckout: (plan: PaidPlan) => void;
}

const PRICE_FORMAT: Intl.NumberFormatOptions = {
  useGrouping: true,
  maximumFractionDigits: 0,
};

const PLAN_CONTENT: Array<{
  key: PaidPlan;
  name: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    key: "basic",
    name: "Basic",
    description: "Proyek kecil dan eksperimen awal.",
    features: [
      "10 kredit PRD per 24 jam",
      "Akses model AI Basic",
      "Tanya jawab AI untuk melengkapi PRD",
      "Ekspor Markdown (.md)",
      "Revisi PRD memakai kredit",
    ],
  },
  {
    key: "vip",
    name: "VIP",
    description: "PRD tanpa batas dan ekspor PDF.",
    features: [
      "PRD tanpa batas",
      "Akses model AI VIP",
      "Ekspor Markdown & PDF",
      "Task breakdown otomatis",
      "Revisi AI tanpa batas",
    ],
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Volume tinggi dan model AI tertinggi.",
    features: [
      "PRD tanpa batas",
      "Akses model AI Enterprise",
      "Ekspor Markdown & PDF",
      "Task breakdown otomatis",
      "Revisi AI tanpa batas",
    ],
  },
];

export function PricingSection({
  pricing,
  isYearly,
  onBillingChange,
  effectivePlan,
  onCheckout,
}: PricingSectionProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const savingsByPlan = PLAN_CONTENT.map((plan) =>
    getYearlySavingsPercent(
      getPlanBasePrice(pricing, plan.key, "monthly"),
      getPlanBasePrice(pricing, plan.key, "yearly")
    )
  );
  const maxSavings = Math.max(...savingsByPlan);
  const minSavings = Math.min(...savingsByPlan);
  const savingsLabel =
    maxSavings > 0 && minSavings === maxSavings
      ? `${maxSavings}%`
      : `hingga ${maxSavings}%`;

  return (
    <>
      <section className="pt-16 pb-10 px-4 md:px-8 max-w-[1040px] mx-auto w-full">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Harga PRDGen
            </h1>
            <p className="mt-4 text-sm md:text-base leading-relaxed text-muted">
              Semua paket bisa membuat PRD. Bedanya di jumlah kredit, model AI,
              dan format ekspor.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <LayoutGroup>
              <div
                role="group"
                aria-label="Siklus pembayaran"
                className="inline-flex items-center border border-border bg-bg-surface p-0.5 rounded-sm"
              >
                <button
                  type="button"
                  aria-pressed={!isYearly}
                  onClick={() => onBillingChange(false)}
                  className={`relative px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer rounded-[1px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-light/60 ${
                    !isYearly ? "text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {!isYearly && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 bg-primary rounded-[1px]"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.18, ease: "easeOut" }
                      }
                    />
                  )}
                  <span className="relative z-10">Bulanan</span>
                </button>
                <button
                  type="button"
                  aria-pressed={isYearly}
                  onClick={() => onBillingChange(true)}
                  className={`relative px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer rounded-[1px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-light/60 ${
                    isYearly ? "text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {isYearly && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 bg-primary rounded-[1px]"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.18, ease: "easeOut" }
                      }
                    />
                  )}
                  <span className="relative z-10">Tahunan</span>
                </button>
              </div>
            </LayoutGroup>
            {maxSavings > 0 && (
              <p className="text-xs text-dim">
                Tahunan hemat {savingsLabel}.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 md:px-8 pb-20 max-w-[1040px] mx-auto w-full">
        {effectivePlan !== "trial" && (
          <div className="mb-8 border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted">
            Paket aktif:{" "}
            <span className="font-medium text-white">
              {effectivePlan.toUpperCase()}
            </span>
            . Paket lebih rendah tidak dapat dibeli selama paket masih aktif.
          </div>
        )}

        <div className="grid grid-cols-1 border-t border-border lg:grid-cols-3 lg:border-b lg:border-border">
          {PLAN_CONTENT.map((plan) => {
            const monthlyPrice = getPlanBasePrice(
              pricing,
              plan.key,
              "monthly"
            );
            const yearlyPrice = getPlanBasePrice(pricing, plan.key, "yearly");
            const price = isYearly ? yearlyPrice : monthlyPrice;
            const monthlyEquivalent = getYearlyMonthlyEquivalent(yearlyPrice);
            const unavailable =
              getPlanLevel(plan.key) < getPlanLevel(effectivePlan);
            const isCurrentPlan = effectivePlan === plan.key;

            return (
              <div
                key={plan.key}
                className="relative flex flex-col border-b border-border py-8 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                {plan.highlighted && (
                  <span className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-primary lg:block" />
                )}

                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {plan.description}
                </p>

                <div className="mt-6" aria-live="polite">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-dim">Rp</span>
                    <NumberFlow
                      value={price}
                      locales="id-ID"
                      format={PRICE_FORMAT}
                      animated={!shouldReduceMotion}
                      respectMotionPreference
                      className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white tabular-nums"
                    />
                    <span className="text-xs text-dim">
                      / {isYearly ? "tahun" : "bulan"}
                    </span>
                  </div>
                  <p className="mt-2 min-h-[18px] text-xs text-dim">
                    {isYearly
                      ? `Setara Rp ${formatRupiah(monthlyEquivalent)} / bulan`
                      : ""}
                  </p>
                </div>

                <ul className="mt-8 border-t border-border text-sm text-muted">
                  {plan.features.map((feature, featureIndex) => (
                    <li
                      key={feature}
                      className="flex gap-3 border-b border-border/60 py-3"
                    >
                      <span className="w-5 shrink-0 text-[11px] leading-5 text-dim tabular-nums">
                        {String(featureIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="leading-5">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onCheckout(plan.key)}
                  disabled={unavailable}
                  title={
                    unavailable
                      ? `Paket ${effectivePlan.toUpperCase()} Anda masih aktif`
                      : undefined
                  }
                  className={`mt-8 w-full border px-4 py-2.5 text-xs font-semibold transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-light/60 ${
                    unavailable
                      ? "cursor-not-allowed border-border text-dim"
                      : plan.highlighted
                        ? "cursor-pointer border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover"
                        : "cursor-pointer border-border text-white hover:border-ink-soft"
                  }`}
                >
                  {unavailable
                    ? "Tidak tersedia"
                    : isCurrentPlan
                      ? "Perpanjang"
                      : `Pilih ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
