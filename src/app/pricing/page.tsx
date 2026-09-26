"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { formatRupiah } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [pricing, setPricing] = useState({
    basic_monthly: 99000,
    vip_monthly: 249000,
    enterprise_monthly: 799000,
    yearly_discount_pct: 20,
  });

  useEffect(() => {
    async function loadPricing() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "pricing_plans")
          .single();

        if (data?.value) {
          setPricing((prev: typeof pricing) => ({ ...prev, ...(data.value as any) }));
        }
      } catch (err) {
        // Fallback to default
      }
    }

    loadPricing();
  }, []);

  const getPrice = (monthlyPrice: number) => {
    if (isYearly) {
      const discounted = monthlyPrice * (1 - pricing.yearly_discount_pct / 100);
      return Math.round(discounted);
    }
    return monthlyPrice;
  };

  return (
    <div className="flex-1 flex flex-col animate-page-enter">
      {/* HEADER */}
      <section className="pt-16 pb-12 px-4 md:px-8 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
          Pilih paket sesuai kebutuhanmu
        </h1>
        <p className="text-sm md:text-base text-muted mb-8">
          Semua paket sudah termasuk AI generator PRD otomatis & ekspor dokumen siap pakai.
        </p>

        {/* Toggle Switch */}
        <div className="inline-flex items-center p-1 bg-bg-surface border border-border rounded-lg">
          <button
            type="button"
            onClick={() => setIsYearly(false)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              !isYearly ? "bg-primary text-white" : "text-muted hover:text-white"
            }`}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setIsYearly(true)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              isYearly ? "bg-primary text-white" : "text-muted hover:text-white"
            }`}
          >
            Tahunan <span className="text-emerald-400 ml-1 font-bold">(Hemat {pricing.yearly_discount_pct}%)</span>
          </button>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="px-4 md:px-8 pb-20 max-w-[1040px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          
          {/* BASIC TIER */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Basic</h3>
              <p className="text-xs text-muted mb-5 min-h-[34px]">
                Pas buat yang baru mulai atau bikin 1-2 proyek sampingan.
              </p>
              <div className="flex items-baseline gap-1 pb-5 mb-5 border-b border-border">
                <span className="text-xs text-dim">Rp</span>
                <span className="text-3xl font-extrabold text-white">
                  {formatRupiah(getPrice(pricing.basic_monthly))}
                </span>
                <span className="text-xs text-dim">/ bln</span>
              </div>
              <ul className="space-y-2.5 text-xs text-muted mb-8">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>5 Dokumen PRD per bulan</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Tanya jawab AI standar</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Ekspor Markdown (.md)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>3x revisi per dokumen</span>
                </li>
              </ul>
            </div>
            <Link
              href="/register?plan=basic"
              className="w-full py-2.5 bg-bg-input hover:border-white/20 border border-border text-white text-xs font-semibold rounded-lg text-center transition-colors"
            >
              Pilih Basic
            </Link>
          </div>

          {/* VIP TIER (HIGHLIGHT) */}
          <div className="bg-[#131627] border border-primary rounded-xl p-6 flex flex-col justify-between shadow-xl shadow-indigo-600/10 relative">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-bold text-white">VIP</h3>
                <span className="text-[11px] bg-primary/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full">
                  Paling Populer
                </span>
              </div>
              <p className="text-xs text-muted mb-5 min-h-[34px]">
                Pilihan utama Product Manager, Freelancer, dan Tech Lead.
              </p>
              <div className="flex items-baseline gap-1 pb-5 mb-5 border-b border-border">
                <span className="text-xs text-dim">Rp</span>
                <span className="text-3xl font-extrabold text-white">
                  {formatRupiah(getPrice(pricing.vip_monthly))}
                </span>
                <span className="text-xs text-dim">/ bln</span>
              </div>
              <ul className="space-y-2.5 text-xs text-muted mb-8">
                <li className="flex items-center gap-2 text-white font-medium">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Unlimited PRD (tanpa batas)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>AI analisa teknis mendalam</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Ekspor .MD & Cetak PDF</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Revisi AI tanpa batasan</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Task breakdown otomatis</span>
                </li>
              </ul>
            </div>
            <Link
              href="/register?plan=vip"
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg text-center transition-colors shadow-lg shadow-indigo-600/30"
            >
              Mulai Paket VIP
            </Link>
          </div>

          {/* ENTERPRISE TIER */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Enterprise</h3>
              <p className="text-xs text-muted mb-5 min-h-[34px]">
                Untuk software house, agensi, dan tim product skala besar.
              </p>
              <div className="flex items-baseline gap-1 pb-5 mb-5 border-b border-border">
                <span className="text-xs text-dim">Rp</span>
                <span className="text-3xl font-extrabold text-white">
                  {formatRupiah(getPrice(pricing.enterprise_monthly))}
                </span>
                <span className="text-xs text-dim">/ bln</span>
              </div>
              <ul className="space-y-2.5 text-xs text-muted mb-8">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Semua keunggulan paket VIP</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Kolaborasi tim & multi-user</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Custom template PRD tim</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Prioritas kecepatan generate tertinggi</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-hover flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Dukungan teknis prioritas 24/7</span>
                </li>
              </ul>
            </div>
            <Link
              href="/register?plan=enterprise"
              className="w-full py-2.5 bg-bg-input hover:border-white/20 border border-border text-white text-xs font-semibold rounded-lg text-center transition-colors"
            >
              Pilih Enterprise
            </Link>
          </div>

        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 px-4 md:px-8 border-t border-border bg-[#0b0d14]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-8">
            Pertanyaan Umum
          </h2>
          <div className="space-y-4 text-xs md:text-sm">
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">Bisa coba gratis dulu?</div>
              <p className="text-muted">
                Bisa. Begitu daftar akun, kamu langsung dapat kuota gratis 3 PRD untuk mencoba seluruh fitur generator AI.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">Pembayarannya lewat apa saja?</div>
              <p className="text-muted">
                Kami mendukung pembayaran melalui QRIS, Virtual Account Bank (BCA, Mandiri, BNI, BRI), dan Kartu Debit/Kredit.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">Bisa cancel langganan kapan saja?</div>
              <p className="text-muted">
                Bisa banget. Tidak ada kontrak mengikat, kamu bisa mengubah atau menghentikan paket kapan pun.
              </p>
            </div>
            <div className="p-4 bg-bg-surface border border-border rounded-lg">
              <div className="font-semibold text-white mb-1">Apakah ide produk saya aman dan terjaga?</div>
              <p className="text-muted">
                Sangat aman. Setiap input deskripsi produk dan hasil dokumen PRD dienkripsi dan hanya dapat diakses oleh akun pemiliknya.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
