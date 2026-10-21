"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ShareAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  prdId: string;
  prdTitle: string;
  prdMarkdown: string;
  isPublic: boolean;
  onPublicChange?: (next: boolean) => void;
}

export function ShareAgentModal({
  isOpen,
  onClose,
  prdId,
  prdTitle,
  prdMarkdown,
  isPublic,
  onPublicChange,
}: ShareAgentModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<"coding_agent" | "frontend_v0" | "curl_command">("coding_agent");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [rawApiUrl, setRawApiUrl] = useState("");
  const [mounted, setMounted] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(isPublic);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPublicEnabled(isPublic);
      setVisibilityError("");
    }
  }, [isOpen, isPublic]);

  useEffect(() => {
    if (typeof window !== "undefined" && prdId) {
      const origin = window.location.origin;
      setShareUrl(`${origin}/share/${prdId}`);
      setRawApiUrl(`${origin}/api/share/${prdId}`);
    }
  }, [prdId]);

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

  if (!isOpen || !mounted) return null;

  const handleTogglePublic = async () => {
    if (!prdId || savingVisibility) return;

    const next = !publicEnabled;
    setSavingVisibility(true);
    setVisibilityError("");

    try {
      const res = await fetch(`/api/prd/${prdId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Gagal mengubah status berbagi.");
      }

      setPublicEnabled(data?.isPublic === true);
      onPublicChange?.(data?.isPublic === true);
    } catch (err: any) {
      setVisibilityError(err?.message || "Gagal mengubah status berbagi.");
    } finally {
      setSavingVisibility(false);
    }
  };

  const getAgentPrompt = () => {
    if (selectedFormat === "curl_command") {
      return `curl -s ${rawApiUrl} | claude`;
    }

    if (selectedFormat === "frontend_v0") {
      return `Anda adalah Senior Frontend Engineer.
Bantu implementasikan antarmuka UI dan prototipe komponen web interaktif berdasarkan Product Requirements Document (PRD) berikut:

Nama Produk: ${prdTitle}
PRD Live Endpoint: ${rawApiUrl}

DOKUMEN PRD LENGKAP:
--- START PRD ---
${prdMarkdown}
--- END PRD ---

Tugas Anda:
1. Analisis Bab 6 (Kebutuhan Fungsional) dan Bab 7 (Alur Pengguna).
2. Buat komponen UI modern, responsif, dan interaktif sesuai spesifikasi alur di atas.
3. Gunakan styling Tailwind CSS dark mode yang bersih dan rapi.`;
    }

    // Default: General Coding Agent (Claude Code / Cursor / Aider / Antigravity / Cline)
    return `Anda adalah Principal Software Engineer & Lead Architect.
Tugas Anda adalah merancang arsitektur dan mengimplementasikan kode proyek secara bertahap berdasarkan Product Requirements Document (PRD) berstandar resmi berikut:

Nama Produk: ${prdTitle}
PRD Raw Endpoint: ${rawApiUrl}

DOKUMEN PRD LENGKAP:
--- START PRD ---
${prdMarkdown}
--- END PRD ---

Instruksi Pengerjaan:
1. Baca seluruh Bab 1 sampai Bab 14 dengan teliti.
2. Ikuti spesifikasi Kebutuhan Fungsional (Bab 6), Alur Pengguna (Bab 7), dan Model Data (Bab 8).
3. Kerjakan implementasi secara terstruktur mengikuti Roadmap Pengembangan & Task Breakdown pada Bab 14 (mulai dari Fase 1: MVP Core).
4. Pastikan arsitektur modular, aman, dan tanpa kode placeholder.`;
  };

  const handleCopy = () => {
    const textToCopy = getAgentPrompt();
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyRawUrl = () => {
    navigator.clipboard.writeText(rawApiUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 animate-scale-in">
      <div className="relative w-full max-w-xl bg-[#161617] border border-border rounded-xl p-5 md:p-6 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Share PRD ke AI Coding Agent
            </h3>
            <p className="text-xs text-muted">
              Hubungkan dokumen PRD langsung ke AI Agent (Claude Code, Cursor, Aider, v0) tanpa perlu file manual.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-white p-1 rounded-lg transition-colors ml-3"
            aria-label="Tutup"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Public Access Toggle */}
        <div className="p-3 bg-bg-input border border-border rounded-lg mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">
                Link publik {publicEnabled ? "aktif" : "nonaktif"}
              </div>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                {publicEnabled
                  ? "Siapa pun yang memiliki link dapat membuka viewer dan membaca endpoint raw. Nonaktifkan untuk mencabut akses."
                  : "Viewer dan endpoint raw hanya bisa dibuka setelah link publik diaktifkan. Dokumen tetap privat."}
              </p>
              {visibilityError && (
                <p className="text-[11px] text-red-400 mt-1.5">{visibilityError}</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={publicEnabled}
              aria-label="Aktifkan link publik"
              onClick={handleTogglePublic}
              disabled={savingVisibility || !prdId}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full border transition-colors disabled:opacity-60 ${
                publicEnabled
                  ? "bg-primary border-primary-light/50"
                  : "bg-black/40 border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                  publicEnabled ? "translate-x-[22px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {!publicEnabled ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center border border-dashed border-border rounded-lg mb-4">
            <p className="text-xs text-muted leading-relaxed max-w-xs">
              Aktifkan link publik untuk membuat URL viewer, endpoint raw markdown,
              dan prompt siap tempel untuk AI Agent.
            </p>
          </div>
        ) : (
          <>
            {/* Live Endpoints Bar */}
            <div className="p-3 bg-bg-input border border-border rounded-lg mb-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-dim text-[11px] font-semibold uppercase tracking-wider">
                <span>Live Agent Endpoint (Raw Markdown):</span>
                <button
                  onClick={handleCopyRawUrl}
                  className="text-primary-light font-medium lowercase"
                >
                  salin url
                </button>
              </div>
              <div className="p-2 bg-black/40 border border-white/5 rounded font-mono text-[11px] text-ink-soft truncate select-all">
                {rawApiUrl}
              </div>
            </div>

            {/* Format Selector */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-semibold text-white block">
                Pilih Format Prompt untuk Agent:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFormat("coding_agent")}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedFormat === "coding_agent"
                      ? "bg-primary border-primary-light/50 text-white font-semibold"
                      : "bg-bg-input border-border text-muted hover:text-white"
                  }`}
                >
                  <div className="font-semibold text-white text-[11px]">Coding Agent</div>
                  <div className="text-[10px] text-muted mt-0.5 leading-tight">Claude Code, Cursor, Aider</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFormat("frontend_v0")}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedFormat === "frontend_v0"
                      ? "bg-primary border-primary-light/50 text-white font-semibold"
                      : "bg-bg-input border-border text-muted hover:text-white"
                  }`}
                >
                  <div className="font-semibold text-white text-[11px]">UI Builder Agent</div>
                  <div className="text-[10px] text-muted mt-0.5 leading-tight">v0.dev, Bolt.new, Lovable</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFormat("curl_command")}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedFormat === "curl_command"
                      ? "bg-primary border-primary-light/50 text-white font-semibold"
                      : "bg-bg-input border-border text-muted hover:text-white"
                  }`}
                >
                  <div className="font-semibold text-white text-[11px]">Terminal Command</div>
                  <div className="text-[10px] text-muted mt-0.5 leading-tight">curl pipe to CLI agent</div>
                </button>
              </div>
            </div>

            {/* Prompt Preview Box */}
            <div className="flex-1 min-h-0 bg-black/40 border border-border rounded-lg p-3 font-mono text-[11px] text-ink-soft overflow-y-auto whitespace-pre-wrap select-all mb-4 max-h-48 leading-relaxed">
              {getAgentPrompt()}
            </div>
          </>
        )}

        {/* Actions Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-border flex-wrap gap-2">
          {publicEnabled ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-white transition-colors"
            >
              Buka Halaman Public Viewer &rarr;
            </a>
          ) : (
            <span className="text-xs text-dim">Akses publik dinonaktifkan.</span>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!publicEnabled}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? "Berhasil Disalin!" : "Salin Prompt untuk Agent"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
