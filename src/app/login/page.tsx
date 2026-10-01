"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cloudflare Turnstile
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!turnstileToken) {
      setErrorMsg("Mohon selesaikan verifikasi keamanan terlebih dahulu.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          turnstileToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal masuk. Periksa email dan password Anda.");
      }

      setSuccessMsg("Berhasil masuk! Membuka Workspace...");
      setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal masuk. Periksa email dan password Anda.");
      // Token Turnstile hanya sekali pakai, jadi perlu token baru
      setTurnstileToken("");
      setTurnstileResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 animate-page-enter">
      <div className="w-full max-w-[380px] bg-bg-surface border border-border rounded-xl p-6 md:p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Masuk ke akun</h1>
          <p className="text-xs text-muted">Buka riwayat dan lanjutkan pembuatan PRD Anda.</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-950/30 border border-red-500/30 text-red-300 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-2.5 bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-white mb-1" htmlFor="email">
              Alamat Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-white" htmlFor="pwd">
                Kata Sandi
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
              >
                Lupa sandi?
              </Link>
            </div>
            <input
              id="pwd"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
            />
          </div>

          <TurnstileWidget
            onVerify={(token) => {
              setTurnstileToken(token);
              setErrorMsg(null);
            }}
            onExpired={() => setTurnstileToken("")}
            onError={() =>
              setErrorMsg("Gagal memuat verifikasi keamanan. Muat ulang halaman.")
            }
            action="login"
            resetKey={turnstileResetKey}
          />

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors mt-2"
          >
            {loading ? "Memproses..." : "Masuk Sekarang"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted">
          Belum punya akun?{" "}
          <Link href="/register" className="text-indigo-400 font-medium hover:underline">
            Daftar gratis di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
