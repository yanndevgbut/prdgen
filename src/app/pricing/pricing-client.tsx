"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/client";
import { QRISPaymentModal } from "@/components/qris-payment-modal";
import { PricingSection } from "@/components/pricing-section";
import {
  getPlanBasePrice,
  type PaidPlan,
  type PricingPlans,
} from "@/lib/pricing";
import { getEffectivePlan, getPlanLevel } from "@/lib/plan";

interface PricingClientProps {
  initialPricing: PricingPlans;
}

const FAQ_ITEMS = [
  {
    question: "Bisa coba gratis dulu?",
    answer:
      "Bisa. Setelah daftar, kamu dapat 3 kredit PRD gratis yang di-reset setiap 24 jam.",
  },
  {
    question: "Pembayaran lewat apa?",
    answer:
      "QRIS. Bisa dipindai dari aplikasi bank dan dompet digital yang mendukung QRIS.",
  },
  {
    question: "Bisa berhenti kapan saja?",
    answer:
      "Bisa. Tidak ada kontrak mengikat. Paket aktif tetap berlaku sampai masa aktifnya habis.",
  },
  {
    question: "Apakah data PRD saya aman?",
    answer:
      "PRD hanya bisa diakses oleh pemilik akun. Kami tidak membagikan dokumenmu ke pengguna lain.",
  },
];

export function PricingClient({ initialPricing }: PricingClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<PaidPlan>("vip");

  // QRIS Modal State
  const [qrisModalOpen, setQrisModalOpen] = useState(false);

  const pricing = initialPricing;
  const effectivePlan = getEffectivePlan(
    profile?.plan,
    profile?.plan_expires_at
  );

  useEffect(() => {
    async function loadData() {
      // Check Session & Profile
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (prof) setProfile(prof);
      }
    }

    loadData();
  }, [supabase]);

  const getPlanPrice = (planKey: PaidPlan) =>
    getPlanBasePrice(pricing, planKey, isYearly ? "yearly" : "monthly");

  const isPlanUnavailable = (planKey: PaidPlan) =>
    getPlanLevel(planKey) < getPlanLevel(effectivePlan);

  const handleOpenCheckout = (planKey: PaidPlan) => {
    if (isPlanUnavailable(planKey)) return;

    if (!user) {
      router.push(`/login?redirect=/pricing`);
      return;
    }
    setSelectedPlanForCheckout(planKey);
    setQrisModalOpen(true);
  };

  // Stabilkan callback agar interval polling di modal tidak terus di-reset
  const handlePaymentSuccess = useCallback(() => {
    setProfile((prev: any) =>
      prev ? { ...prev, plan: selectedPlanForCheckout } : prev
    );
  }, [selectedPlanForCheckout]);

  return (
    <div className="flex-1 flex flex-col animate-page-enter">
      {/* QRIS PAYMENT & CHECKOUT MODAL */}
      <QRISPaymentModal
        isOpen={qrisModalOpen}
        onClose={() => setQrisModalOpen(false)}
        selectedPlan={selectedPlanForCheckout}
        billingCycle={isYearly ? "yearly" : "monthly"}
        basePrice={getPlanPrice(selectedPlanForCheckout)}
        userEmail={user?.email || ""}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <PricingSection
        pricing={pricing}
        isYearly={isYearly}
        onBillingChange={setIsYearly}
        effectivePlan={effectivePlan}
        onCheckout={handleOpenCheckout}
      />

      {/* FAQ SECTION */}
      <section className="px-4 md:px-8 py-16 border-t border-border">
        <div className="max-w-[1040px] mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-8">
            Pertanyaan Umum
          </h2>
          <div className="max-w-3xl border-t border-border">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="border-b border-border py-5"
              >
                <h3 className="text-sm font-semibold text-white mb-2">
                  {item.question}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
