import Link from "next/link";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col animate-page-enter">
      {/* HERO SECTION */}
      <section className="py-20 md:py-28 px-4 md:px-8 flex justify-center">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 flex flex-col">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4 text-white">
              Bikin PRD lengkap tanpa repot berjam-jam
            </h1>
            <p className="text-base md:text-lg text-muted leading-relaxed mb-8 max-w-xl">
              Tulis ide dasarmu, jawab beberapa detail teknis, dan langsung dapat dokumen PRD terstruktur rapi yang siap dibagiin ke tim developer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/app"
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg text-center transition-all shadow-lg shadow-indigo-600/20"
              >
                Mulai Bikin PRD Sekarang
              </Link>
              <Link
                href="#cara-kerja"
                className="px-6 py-3 bg-bg-surface hover:bg-bg-hover text-muted hover:text-white border border-border text-sm font-medium rounded-lg text-center transition-colors"
              >
                Lihat Cara Kerja
              </Link>
            </div>
          </div>

          {/* Right Visual Mockup */}
          <div className="lg:col-span-5">
            <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-2xl">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border text-xs text-dim">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="ml-2 font-mono text-[11px] text-muted">PRD_Ecommerce_v1.md</span>
              </div>
              <div className="text-sm font-bold text-white mb-2">Platform E-Commerce Multivendor</div>
              
              <div className="text-xs font-semibold text-indigo-300 mt-3 mb-1">1. Ringkasan Produk</div>
              <p className="text-xs text-muted leading-relaxed mb-3">
                Marketplace modern untuk memudahkan toko online berjualan dengan pembayaran otomatis dan pelacakan kurir.
              </p>
              
              <div className="text-xs font-semibold text-indigo-300 mt-3 mb-1">2. Spesifikasi Teknis</div>
              <p className="text-xs text-muted leading-relaxed mb-3">
                Next.js App Router, Tailwind CSS, Supabase PostgreSQL, Midtrans Payment Gateway.
              </p>

              <div className="text-xs font-semibold text-indigo-300 mt-3 mb-1">3. Task Breakdown Sprint</div>
              <ul className="text-xs text-muted space-y-1.5 ml-1 list-none">
                <li className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Desain skema tabel database & model data</span>
                </li>
                <li className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Implementasi katalog produk & keranjang</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span>Integrasi webhook payment gateway & kurir</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* CARA KERJA SECTION */}
      <section className="py-20 px-4 md:px-8 border-t border-border bg-[#0b0d14]" id="cara-kerja">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-white">
            4 Langkah simpel dari ide sampai jadi PRD
          </h2>
          <p className="text-sm md:text-base text-muted mb-12">
            Nggak perlu pusing mikirin template manual yang berantakan. Ikuti alur cepat ini:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-xs font-bold text-indigo-400 mb-2">Langkah 1</div>
              <h3 className="text-sm font-semibold text-white mb-2">Tulis ide produk</h3>
              <p className="text-xs text-muted leading-relaxed">
                Ketik konsep awal, masalah yang mau diselesaikan, atau fitur utama produkmu.
              </p>
            </div>

            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-xs font-bold text-indigo-400 mb-2">Langkah 2</div>
              <h3 className="text-sm font-semibold text-white mb-2">Lengkapi detail</h3>
              <p className="text-xs text-muted leading-relaxed">
                Pilih atau ketik preferensi tech stack, database, target audiens, dan integrasi pihak ketiga.
              </p>
            </div>

            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-xs font-bold text-indigo-400 mb-2">Langkah 3</div>
              <h3 className="text-sm font-semibold text-white mb-2">Edit & revisi</h3>
              <p className="text-xs text-muted leading-relaxed">
                Lihat draf PRD yang disusun AI dan berikan instruksi revisi instan jika ada yang ingin disesuaikan.
              </p>
            </div>

            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-xs font-bold text-indigo-400 mb-2">Langkah 4</div>
              <h3 className="text-sm font-semibold text-white mb-2">Download & bagikan</h3>
              <p className="text-xs text-muted leading-relaxed">
                Tinggal salin teks ke clipboard atau unduh file format Markdown (.md) dan PDF untuk developer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 px-4 md:px-8 border-t border-border text-center">
        <div className="max-w-xl mx-auto flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white">
            Mau coba bikin PRD sekarang?
          </h2>
          <p className="text-sm md:text-base text-muted mb-8">
            Cepat, rapi, dan langsung bisa dieksekusi oleh tim engineering.
          </p>
          <Link
            href="/app"
            className="px-8 py-3.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-indigo-600/25"
          >
            Buka Workspace Gratis
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
