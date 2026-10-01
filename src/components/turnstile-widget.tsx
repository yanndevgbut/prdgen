"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  action?: string;
  /**Naikkan nilai ini untuk me-reset widget (token bersifat sekali pakai). */
  resetKey?: number;
}

/**
 * Widget Cloudflare Turnstile.
 * Dimuat via next/script sehingga tidak menambah dependency baru.
 * Tipe "managed" dipilih agar challenge otomatis tanpa mengganggu user asli.
 */
export function TurnstileWidget({
  onVerify,
  onExpired,
  onError,
  action = "auth",
  resetKey = 0,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "dark",
      action,
      callback: (token: string) => onVerify(token),
      "expired-callback": () => onExpired?.(),
      "error-callback": () => onError?.(),
    });
  }, [action, onVerify, onExpired, onError]);

  useEffect(() => {
    if (scriptReady) renderWidget();
  }, [scriptReady, renderWidget]);

  // Reset widget setiap kali resetKey berubah (misal setelah submit gagal).
  useEffect(() => {
    if (resetKey === 0) return;
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  useEffect(() => {
    return () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) {
    return (
      <div className="px-3 py-2.5 bg-bg-input border border-border rounded-lg text-[11px] text-dim leading-relaxed">
        Verifikasi keamanan belum dikonfigurasi (
        <span className="font-mono">NEXT_PUBLIC_TURNSTILE_SITE_KEY</span>). Fungsional
        normal di mode pengembangan.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
      <p className="text-center text-[10px] text-dim">Dilindungi oleh Cloudflare Turnstile</p>
    </div>
  );
}
