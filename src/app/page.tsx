import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { HeroPreview } from "@/components/hero-preview";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
  description:
    "Tulis ide produk dalam beberapa kalimat. PRDGen menyusun PRD 14 bab lengkap berisi user flow, skema database, dan daftar tugas sprint, siap diunduh sebagai Markdown atau PDF.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: `Apa itu ${BRAND_NAME}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${BRAND_NAME} adalah generator Product Requirements Document (PRD) yang membantu kamu menyusun dokumen spesifikasi produk 14 bab lengkap dalam bahasa Indonesia.`,
      },
    },
    {
      "@type": "Question",
      name: `Bagaimana cara menyusun PRD di ${BRAND_NAME}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tulis ide produk, jawab beberapa pertanyaan teknis dari AI, lalu periksa draf PRD 14 bab lengkap yang siap diserahkan ke tim developer.",
      },
    },
    {
      "@type": "Question",
      name: `Apakah ${BRAND_NAME} bisa dicoba gratis?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bisa. Setiap akun baru mendapat 3 kredit gratis yang terisi ulang otomatis setiap 24 jam untuk mencoba seluruh fitur sebelum memilih paket berbayar.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col animate-page-enter">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* HERO SECTION */}
      <section className="py-20 md:py-28 px-4 md:px-8 flex justify-center ambient-hero">
        <div className="max-w-[1120px] w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 flex flex-col">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4 text-white">
              Dari ide tiga kalimat ke PRD yang siap dikerjakan tim
            </h1>
            <p className="text-base md:text-lg text-muted leading-relaxed mb-8 max-w-xl">
              Ceritakan produkmu, jawab beberapa pertanyaan tentang pengguna dan tech stack, lalu dapatkan PRD 14 bab: user flow, skema database, sampai daftar tugas sprint.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/app"
                className="px-6 py-3.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg text-center shadow-[0_4px_20px_-4px_rgba(178,58,50,0.5)] hover:shadow-[0_6px_24px_-2px_rgba(178,58,50,0.65)] hover:-translate-y-0.5 transition-all duration-150"
              >
                Mulai Susun PRD
              </Link>
              <Link
                href="#cara-kerja"
                className="px-6 py-3.5 bg-bg-surface hover:bg-bg-hover text-muted hover:text-white border border-border text-sm font-medium rounded-lg text-center transition-colors"
              >
                Lihat Alur Kerja
              </Link>
            </div>
          </div>

          {/* Right Visual Mockup (Interactive Preview) */}
          <div className="lg:col-span-5">
            <HeroPreview />
          </div>

        </div>
      </section>

      {/* CARA KERJA SECTION */}
      <section className="py-20 px-4 md:px-8 border-t border-border bg-[#121213]" id="cara-kerja">
        <div className="max-w-[1100px] mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-white">
              Dari ide mentah sampai siap dibaca developer
            </h2>
            <p className="text-sm md:text-base text-muted">
              Alur nyata dari contoh marketplace kerajinan Jogja dengan pembayaran QRIS:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="group bg-bg-surface border border-border hover:border-primary/40 rounded-xl p-5 flex flex-col transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase text-dim tracking-wider">Tahap 01</span>
                <span className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-ink transition-colors">Tulis ide produk</h3>
              <p className="text-xs text-muted leading-relaxed">
                Ketik konsep awal: marketplace kerajinan UMKM Jogja dengan pembayaran QRIS dan kurir lokal.
              </p>
            </div>

            <div className="group bg-bg-surface border border-border hover:border-primary/40 rounded-xl p-5 flex flex-col transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase text-dim tracking-wider">Tahap 02</span>
                <span className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-ink transition-colors">Jawab detail teknis</h3>
              <p className="text-xs text-muted leading-relaxed">
                AI menanyakan hal penting: metode autentikasi, kalkulasi ongkir, dan alur verifikasi penjual.
              </p>
            </div>

            <div className="group bg-bg-surface border border-border hover:border-primary/40 rounded-xl p-5 flex flex-col transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase text-dim tracking-wider">Tahap 03</span>
                <span className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-ink transition-colors">Revisi dengan kalimat biasa</h3>
              <p className="text-xs text-muted leading-relaxed">
                Draf langsung tersusun. Minta penyesuaian seperti "Tambahkan fitur ulasan pembeli di sprint 3".
              </p>
            </div>

            <div className="group bg-bg-surface border border-border hover:border-primary/40 rounded-xl p-5 flex flex-col transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase text-dim tracking-wider">Tahap 04</span>
                <span className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-ink transition-colors">Unduh & bagikan</h3>
              <p className="text-xs text-muted leading-relaxed">
                Salin teks, ekspor Markdown (.md), cetak PDF, atau pakai link publik yang bisa dibaca langsung oleh Cursor dan Claude Code.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 px-4 md:px-8 border-t border-border text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-radial from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="max-w-xl mx-auto flex flex-col items-center relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white">
            Coba dengan ide yang sedang kamu kerjakan
          </h2>
          <p className="text-sm md:text-base text-muted mb-8 leading-relaxed">
            Akun baru dapat 3 kredit gratis yang terisi ulang tiap 24 jam.
          </p>
          <Link
            href="/app"
            className="px-8 py-3.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg shadow-[0_4px_24px_-4px_rgba(178,58,50,0.55)] hover:shadow-[0_8px_30px_rgba(178,58,50,0.7)] hover:-translate-y-0.5 transition-all duration-150"
          >
            Buka Workspace Gratis
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
