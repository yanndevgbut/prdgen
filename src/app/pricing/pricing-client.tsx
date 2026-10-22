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
      <section className="py-16 px-4 md:px-8 border-t border-border bg-[#121213]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-8">
            Pertanyaan Umum
          </h2>
          <div className="space-y-4 text-xs md:text-sm">
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">
                Bisa coba gratis dulu?
              </div>
              <p className="text-muted">
                Bisa. Begitu daftar akun, kamu langsung dapat 3 kredit PRD gratis
                yang di-reset otomatis setiap 24 jam untuk mencoba seluruh fitur
                generator AI.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">
                Pembayarannya lewat apa saja?
              </div>
              <p className="text-muted">
                Kami mendukung pembayaran instan melalui QRIS yang dapat di-scan
                dari aplikasi BCA, Mandiri, BNI, BRI, GoPay, OVO, ShopeePay, dan
                DANA.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">
                Bisa cancel langganan kapan saja?
              </div>
              <p className="text-muted">
                Bisa banget. Tidak ada kontrak mengikat, kamu bisa mengubah atau
                menghentikan paket kapan pun.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">
                Apakah ide produk saya aman dan terjaga?
              </div>
              <p className="text-muted">
                Sangat aman. Setiap input deskripsi produk dan hasil dokumen PRD
                dienkripsi dan hanya dapat diakses oleh akun pemiliknya.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
