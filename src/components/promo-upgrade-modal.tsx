"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface PromoUpgradeModalProps {
  userPlan?: string;
  prdCount?: number;
  isOpenControlled?: boolean;
  onCloseControlled?: () => void;
}

export function PromoUpgradeModal({
  userPlan,
  prdCount,
  isOpenControlled,
  onCloseControlled,
}: PromoUpgradeModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isControlled = typeof isOpenControlled === "boolean";
  const isOpen = isControlled ? isOpenControlled : internalOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isControlled) return;

    // Hanya tampilkan otomatis jika user berada di paket trial
    if (userPlan && userPlan.toLowerCase() !== "trial") {
      return;
    }

    const dismissed = sessionStorage.getItem("prdgen_promo_dismissed");
    if (dismissed) {
      return;
    }

    const timer = setTimeout(() => {
      setInternalOpen(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [userPlan, isControlled]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const handleClose = () => {
    if (onCloseControlled) {
      onCloseControlled();
    } else {
      setInternalOpen(false);
    }
    sessionStorage.setItem("prdgen_promo_dismissed", "true");
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-scale-in">
      <div className="relative w-full max-w-md bg-[#131627] border border-primary/50 rounded-2xl p-6 md:p-7 shadow-2xl shadow-indigo-600/25 overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Tag & Close Button */}
        <div className="flex justify-between items-center mb-3 relative z-10">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/25 text-indigo-300 px-2.5 py-1 rounded-full border border-primary/40">
            PROMO SPESIAL UPGRADE PAKET
          </span>
          <button
            onClick={handleClose}
            className="text-muted hover:text-white p-1 rounded-lg transition-colors flex items-center justify-center"
            aria-label="Tutup"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h3 className="text-xl font-extrabold text-white tracking-tight mb-2">
            Upgrade ke VIP & Bikin PRD Tanpa Batas!
          </h3>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Anda saat ini menggunakan paket <strong className="text-indigo-300 uppercase">{userPlan || "Trial"} ({prdCount || 0}/3 PRD)</strong>. Upgrade ke VIP untuk membuka akses model AI premium & fitur lengkap:
          </p>

          <ul className="space-y-2 text-xs text-muted mb-6">
            <li className="flex items-center gap-2 text-white">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span><strong>Akses Semua Model AI Premium</strong> (Gemini Pro, GPT-4o, Claude)</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span><strong>Pembuatan PRD Tanpa Batas</strong> (Unlimited Docs)</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Visual Roadmap Timeline & Alur Pengguna Interaktif</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Revisi AI Tanpa Batasan & Ekspor Lengkap (MD/PDF)</span>
            </li>
          </ul>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Link
              href="/pricing"
              onClick={handleClose}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl text-center transition-all shadow-lg shadow-indigo-600/30"
            >
              Lihat Paket VIP (Hemat 20%)
            </Link>
            <button
              onClick={handleClose}
              className="w-full py-2 text-xs text-dim hover:text-muted transition-colors font-medium"
            >
              Lanjutkan dengan Paket Saat Ini
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
