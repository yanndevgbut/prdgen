"use client";

import { useState } from "react";

export function HeroPreview() {
  const [activeTab, setActiveTab] = useState<"prd" | "flow" | "roadmap">("prd");
  const [copied, setCopied] = useState(false);
  const [tasks, setTasks] = useState([
    { text: "Desain skema tabel database & model data", done: true },
    { text: "Implementasi katalog produk & checkout", done: true },
    { text: "Integrasi webhook QRIS & kurir ekspedisi", done: false },
  ]);

  const toggleTask = (index: number) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t))
    );
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(
      `# Platform E-Commerce Multivendor\n\n## 1. Ringkasan Produk\nMarketplace modern untuk memudahkan toko online berjualan dengan pembayaran otomatis dan pelacakan kurir.\n\n## 2. Spesifikasi Teknis\nNext.js App Router, Tailwind CSS, Supabase PostgreSQL, Midtrans Payment Gateway.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {/* Subtle outer glow on hover */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-transparent to-primary/10 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500 pointer-events-none" />

      <div className="relative bg-bg-surface border border-border/80 rounded-xl overflow-hidden shadow-2xl transition-all">
        {/* Terminal / Document Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111112] border-b border-border/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E5484D]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2C14E]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#5BD6A2]/70" />

            {/* Document Tabs */}
            <div className="ml-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("prd")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  activeTab === "prd"
                    ? "bg-bg-surface text-white border border-border/60"
                    : "text-dim hover:text-muted"
                }`}
              >
                PRD_v1.md
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("flow")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  activeTab === "flow"
                    ? "bg-bg-surface text-white border border-border/60"
                    : "text-dim hover:text-muted"
                }`}
              >
                UserFlow.md
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("roadmap")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  activeTab === "roadmap"
                    ? "bg-bg-surface text-white border border-border/60"
                    : "text-dim hover:text-muted"
                }`}
              >
                Sprint.md
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] text-dim hover:text-white px-2 py-0.5 rounded border border-border/40 hover:border-border transition-colors font-mono"
            >
              {copied ? "Tersalin!" : "Salin"}
            </button>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="AI Ready" />
          </div>
        </div>

        {/* Document Content View */}
        <div className="p-5 font-sans min-h-[310px] text-xs">
          {activeTab === "prd" && (
            <div className="animate-page-enter space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono text-dim tracking-wider">
                  # DOKUMEN SPESIFIKASI PRODUK
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Platform E-Commerce Multivendor
                </h3>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-ink-soft mb-1 font-mono">
                  ## 1. Ringkasan & Problem Statement
                </div>
                <p className="text-muted leading-relaxed">
                  Marketplace modern untuk toko online lokal dengan sistem multi-gudang, pembayaran QRIS otomatis, dan auto-kalkulasi ongkir logistik.
                </p>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-ink-soft mb-1 font-mono">
                  ## 2. Arsitektur & Tech Stack
                </div>
                <p className="text-muted leading-relaxed">
                  Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL dengan RLS, Midtrans QRIS.
                </p>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-ink-soft mb-2 font-mono flex items-center justify-between">
                  <span>## 3. Task Breakdown Sprint 1</span>
                  <span className="text-[10px] text-dim font-normal">Klik untuk centang</span>
                </div>
                <ul className="space-y-1.5 list-none">
                  {tasks.map((task, idx) => (
                    <li
                      key={task.text}
                      onClick={() => toggleTask(idx)}
                      className={`flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                        task.done
                          ? "text-muted hover:text-white"
                          : "text-white font-medium hover:bg-white/[0.02]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => {}}
                        className="rounded border-border bg-bg-surface text-primary focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span className={task.done ? "line-through text-dim" : ""}>
                        {task.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "flow" && (
            <div className="animate-page-enter space-y-3">
              <span className="text-[10px] uppercase font-mono text-dim tracking-wider">
                # ALUR PENGGUNA (USER FLOW)
              </span>
              <div className="space-y-2 mt-2">
                <div className="p-3 bg-bg-surface border border-border/80 rounded-lg">
                  <div className="text-[11px] font-bold text-white mb-1">
                    Alur 1: Pembeli Checkout Produk
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted font-mono mt-2">
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-ink-soft">Pilih Produk</span>
                    <span className="text-dim">→</span>
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-ink-soft">Keranjang</span>
                    <span className="text-dim">→</span>
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-primary-light">Scan QRIS</span>
                    <span className="text-dim">→</span>
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-emerald-400">Notifikasi Sukses</span>
                  </div>
                </div>

                <div className="p-3 bg-bg-surface border border-border/80 rounded-lg">
                  <div className="text-[11px] font-bold text-white mb-1">
                    Alur 2: Penjual Proses Pesanan
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted font-mono mt-2">
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-ink-soft">Order Masuk</span>
                    <span className="text-dim">→</span>
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-ink-soft">Cetak Resi</span>
                    <span className="text-dim">→</span>
                    <span className="px-2 py-0.5 bg-[#1C1C1E] border border-border/60 rounded text-ink-soft">Pickup Kurir</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "roadmap" && (
            <div className="animate-page-enter space-y-3">
              <span className="text-[10px] uppercase font-mono text-dim tracking-wider">
                # SPRINT ROADMAP & DELIVERABLES
              </span>
              <div className="space-y-2 mt-2">
                <div className="p-3 bg-bg-surface border border-border/80 rounded-lg flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Sprint 1: Core Foundation</div>
                    <p className="text-[11px] text-muted mt-1">Auth, schema database, katalog produk, upload media.</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Selesai
                  </span>
                </div>

                <div className="p-3 bg-bg-surface border border-border/80 rounded-lg flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Sprint 2: Payment & Checkout</div>
                    <p className="text-[11px] text-muted mt-1">Integrasi webhook QRIS, kalkulasi ongkir, email receipt.</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary-light border border-primary/20 px-2 py-0.5 rounded">
                    Berjalan
                  </span>
                </div>

                <div className="p-3 bg-bg-surface border border-border/80 rounded-lg flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Sprint 3: Analytics & Review</div>
                    <p className="text-[11px] text-muted mt-1">Dashboard omzet penjual, ulasan pembeli, laporan bulanan.</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-white/5 text-dim border border-border/50 px-2 py-0.5 rounded">
                    Upcoming
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-[#111112] border-t border-border/80 flex items-center justify-between text-[11px] text-dim">
          <span>14 Bab PRD • Format Markdown (.md)</span>
          <span className="text-emerald-400 font-mono">Siap diserahkan ke developer</span>
        </div>
      </div>
    </div>
  );
}
