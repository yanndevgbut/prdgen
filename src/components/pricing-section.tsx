"use client";

// Arah visual dan animasi diadaptasi dari pricing section 21st.dev,
// lalu disesuaikan dengan tema, data, dan alur checkout PRDGen.
import NumberFlow from "@number-flow/react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { Check, Sparkles } from "lucide-react";
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
  cta: string;
  highlighted?: boolean;
}> = [
  {
    key: "basic",
    name: "Basic",
    description: "Pas buat yang baru mulai atau bikin 1-2 proyek sampingan.",
    features: [
      "10 Kredit PRD per 24 jam (Reset harian)",
      "Tanya jawab AI spesifik",
      "Ekspor Markdown (.md)",
      "Revisi PRD (1 kredit per revisi)",
    ],
    cta: "Pilih Basic (QRIS)",
  },
  {
    key: "vip",
    name: "VIP",
    description: "Pilihan utama Product Manager, Freelancer, dan Tech Lead.",
    features: [
      "Unlimited PRD (tanpa batas)",
      "AI analisa teknis mendalam",
      "Ekspor .MD & Cetak PDF",
      "Revisi AI tanpa batasan",
      "Task breakdown otomatis",
    ],
    cta: "Bayar VIP dengan QRIS",
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Untuk software house, agensi, dan tim product skala besar.",
    features: [
      "Semua keunggulan paket VIP",
      "Kolaborasi tim & multi-user",
      "Custom template PRD tim",
      "Prioritas kecepatan generate tertinggi",
      "Dukungan teknis prioritas 24/7",
    ],
    cta: "Pilih Enterprise (QRIS)",
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

  const maxSavings = Math.max(
    ...PLAN_CONTENT.map((plan) =>
      getYearlySavingsPercent(
        getPlanBasePrice(pricing, plan.key, "monthly"),
        getPlanBasePrice(pricing, plan.key, "yearly")
      )
    )
  );

  return (
    <>
      <section className="pt-16 pb-10 px-4 md:px-8 text-center max-w-2xl mx-auto">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 1, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: "easeOut" }
          }
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase text-primary-light bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-4">
            <Sparkles className="w-3 h-3" />
            Paket PRDGen
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            Pilih paket sesuai kebutuhanmu
          </h1>
          <p className="text-sm md:text-base text-muted mb-4">
            Semua paket sudah termasuk AI generator PRD otomatis &amp; ekspor dokumen siap pakai.
          </p>

          {effectivePlan !== "trial" && (
            <p className="text-xs text-muted mb-4">
              Paket aktif Anda:{" "}
              <span className="text-white font-semibold">
                {effectivePlan.toUpperCase()}
              </span>
              . Paket yang lebih rendah tidak dapat dibeli selama paket masih aktif.
            </p>
          )}

          <LayoutGroup>
            <div
              role="group"
              aria-label="Siklus pembayaran"
              className="inline-flex items-center p-1 bg-bg-surface border border-border rounded-lg relative"
            >
              <button
                type="button"
                aria-pressed={!isYearly}
                onClick={() => onBillingChange(false)}
                className={`relative px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light/60 ${
                  !isYearly ? "text-white" : "text-muted hover:text-white"
                }`}
              >
                {!isYearly && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
                <span className="relative z-10">Bulanan</span>
              </button>
              <button
                type="button"
                aria-pressed={isYearly}
                onClick={() => onBillingChange(true)}
                className={`relative px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light/60 ${
                  isYearly ? "text-white" : "text-muted hover:text-white"
                }`}
              >
                {isYearly && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
                <span className="relative z-10">
                  Tahunan
                  {maxSavings > 0 && (
                    <span className="text-emerald-300 ml-1 font-bold">
                      (Hemat {maxSavings}%)
                    </span>
                  )}
                </span>
              </button>
            </div>
          </LayoutGroup>
        </motion.div>
      </section>

      <section className="px-4 md:px-8 pb-20 max-w-[1040px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLAN_CONTENT.map((plan, index) => {
            const monthlyPrice = getPlanBasePrice(
              pricing,
              plan.key,
              "monthly"
            );
            const yearlyPrice = getPlanBasePrice(pricing, plan.key, "yearly");
            const price = isYearly ? yearlyPrice : monthlyPrice;
            const savings = getYearlySavingsPercent(monthlyPrice, yearlyPrice);
            const monthlyEquivalent = getYearlyMonthlyEquivalent(yearlyPrice);
            const unavailable =
              getPlanLevel(plan.key) < getPlanLevel(effectivePlan);
            const isCurrentPlan = effectivePlan === plan.key;

            return (
              <motion.div
                key={plan.key}
                initial={
                  shouldReduceMotion ? false : { opacity: 1, y: 12 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.35,
                        delay: index * 0.06,
                        ease: "easeOut",
                      }
                }
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                className={`relative flex flex-col justify-between rounded-xl border p-6 ${
                  plan.highlighted
                    ? "bg-[#1A1A1C] border-primary-light/50 shadow-[0_24px_80px_-40px_rgba(178,58,50,0.65)]"
                    : "bg-bg-surface border-border"
                }`}
              >
                {plan.highlighted && (
                  <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary-light/80 to-transparent" />
                )}

                <div>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    {plan.highlighted && (
                      <span className="text-[11px] bg-primary/20 text-primary-light font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        Paling Populer
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mb-5 min-h-[34px]">
                    {plan.description}
                  </p>

                  <div className="pb-5 mb-5 border-b border-border">
                    <div className="flex items-baseline gap-1" aria-live="polite">
                      <span className="text-xs text-dim">Rp</span>
                      <NumberFlow
                        value={price}
                        locales="id-ID"
                        format={PRICE_FORMAT}
                        animated={!shouldReduceMotion}
                        respectMotionPreference
                        className="text-4xl font-extrabold tracking-tight text-white tabular-nums"
                      />
                      <span className="text-xs text-dim">
                        / {isYearly ? "tahun" : "bulan"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 min-h-[20px]">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={isYearly ? "yearly" : "monthly"}
                          initial={
                            shouldReduceMotion
                              ? false
                              : { opacity: 0, y: 3 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: -3 }
                          }
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : { duration: 0.18, ease: "easeOut" }
                          }
                          className="text-[11px] text-muted"
                        >
                          {isYearly
                            ? `Setara ${formatRupiah(monthlyEquivalent)} / bulan`
                            : "Ditagih setiap bulan"}
                        </motion.p>
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {isYearly && savings > 0 && (
                          <motion.span
                            key="savings"
                            initial={
                              shouldReduceMotion
                                ? false
                                : { opacity: 0, scale: 0.9 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={
                              shouldReduceMotion
                                ? { duration: 0 }
                                : { duration: 0.2, ease: "easeOut" }
                            }
                            className="text-[10px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full whitespace-nowrap"
                          >
                            Hemat {savings}%
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-muted mb-8 flex-1">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={feature}
                        className={`flex items-center gap-2 ${
                          plan.highlighted && featureIndex === 0
                            ? "text-white font-medium"
                            : ""
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onCheckout(plan.key)}
                  disabled={unavailable}
                  title={
                    unavailable
                      ? `Paket ${effectivePlan.toUpperCase()} Anda masih aktif`
                      : undefined
                  }
                  className={`w-full py-2.5 text-xs font-semibold rounded-lg text-center transition-all ${
                    unavailable
                      ? "bg-bg-input/50 border border-border text-white opacity-50 cursor-not-allowed"
                      : plan.highlighted
                        ? "bg-primary hover:bg-primary-hover text-white cursor-pointer shadow-[0_10px_30px_-16px_rgba(178,58,50,0.9)]"
                        : "bg-bg-input border border-border hover:border-white/20 text-white cursor-pointer"
                  }`}
                >
                  {unavailable
                    ? "Tidak tersedia"
                    : isCurrentPlan
                      ? "Paket Saat Ini"
                      : plan.cta}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>
    </>
  );
}
