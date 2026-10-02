"use client";

import { useEffect, useRef, useState } from "react";

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
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Loader script Turnstile di level modul dengan cache Promise.
 *
 * Dipakai Promise (bukan next/script) supaya:
 * 1. Promise dijamin resolve/reject lewat onload, onerror, dan timeout.
 * 2. Navigasi client-side antar halaman (login/daftar/reset) tidak membuat
 *    widget gagal, karena hasil load di-cache dan dipakai ulang.
 */
let loaderPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const fail = (message: string) => {
      // Reset cache supaya tombol "Coba lagi" bisa mengulang.
      loaderPromise = null;
      reject(new Error(message));
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-cf-turnstile="true"]'
    );

    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-cf-turnstile", "true");
      document.head.appendChild(script);
    }

    let timer = 0;
    const finish = (fn: () => void) => {
      window.clearTimeout(timer);
      fn();
    };

    timer = window.setTimeout(() => {
      finish(() => fail("Timeout memuat Cloudflare Turnstile (15 detik)."));
    }, 15000);

    script.onload = () =>
      finish(() => {
        if (window.turnstile) {
          resolve();
        } else {
          fail("Script termuat tetapi window.turnstile tidak tersedia.");
        }
      });

    script.onerror = () =>
      finish(() =>
        fail("Script Turnstile gagal dimuat. Diblokir jaringan atau adblocker?")
      );
  });

  return loaderPromise;
}

type WidgetStatus = "loading" | "ready" | "error";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  action?: string;
  /** Naikkan nilai ini untuk me-reset widget (token bersifat sekali pakai). */
  resetKey?: number;
}

export function TurnstileWidget({
  onVerify,
  onExpired,
  onError,
  action = "auth",
  resetKey = 0,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<WidgetStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Muat script lalu render widget. Berjalan ulang setiap "attempt" berubah.
  useEffect(() => {
    let cancelled = false;

    if (!SITE_KEY) {
      setStatus("error");
      setErrorMsg(
        "Verifikasi keamanan belum dikonfigurasi: NEXT_PUBLIC_TURNSTILE_SITE_KEY belum di-set."
      );
      return;
    }

    setStatus("loading");
    setErrorMsg(null);
    console.log("[turnstile] memuat script Turnstile...");

    loadTurnstile()
      .then(() => {
        if (cancelled) return;

        if (!window.turnstile) {
          setStatus("error");
          setErrorMsg("window.turnstile tidak tersedia setelah script dimuat.");
          console.error("[turnstile] window.turnstile undefined");
          return;
        }

        if (!containerRef.current) {
          console.warn("[turnstile] container tidak tersedia, render dilewati");
          return;
        }

        // Bersihkan widget lama bila ada (mis. saat retry).
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          action,
          callback: (token: string) => {
            console.log("[turnstile] token diterima");
            onVerify(token);
          },
          "expired-callback": () => {
            console.log("[turnstile] token kedaluwarsa");
            onExpired?.();
          },
          "error-callback": () => {
            console.warn("[turnstile] Cloudstile melaporkan error pada widget");
            setErrorMsg(
              "Cloudflare melaporkan error pada widget. Pastikan hostname prdgen.my.id terdaftar di pengaturan widget Turnstile."
            );
            onError?.();
          },
        });

        widgetIdRef.current = widgetId;
        setStatus("ready");
        console.log("[turnstile] widget berhasil dirender, id =", widgetId);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error("[turnstile] gagal memuat:", err.message);
        setStatus("error");
        setErrorMsg(err.message);
      });

    return () => {
      cancelled = true;
    };
    // Sengaja tidak menyertakan callback: re-render widget akan membuang token
    // yang sudah dipakai. Callback sengaja dibaca saat render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Reset widget setiap kali resetKey berubah (mis. setelah submit gagal).
  useEffect(() => {
    if (resetKey === 0) return;
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  // Bersihkan saat komponen dilepas (mis. pindah halaman).
  useEffect(() => {
    return () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (status === "error") {
    return (
      <div className="space-y-2">
        <div className="px-3 py-2.5 bg-amber-950/30 border border-amber-500/40 rounded-lg">
          <p className="text-[11px] text-amber-300 leading-relaxed">
            {errorMsg || "Verifikasi keamanan gagal dimuat."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="w-full py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="min-h-[65px] flex items-center justify-center"
      />
      {status === "loading" && (
        <p className="text-center text-[10px] text-dim">
          Memuat verifikasi keamanan...
        </p>
      )}
      {status === "ready" && (
        <p className="text-center text-[10px] text-dim">
          Dilindungi oleh Cloudflare Turnstile
        </p>
      )}
      {status === "ready" && errorMsg && (
        <p className="text-center text-[10px] text-amber-400">{errorMsg}</p>
      )}
    </div>
  );
}