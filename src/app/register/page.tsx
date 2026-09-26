"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  // Registration step (1: Form, 2: OTP Verification)
  const [step, setStep] = useState<1 | 2>(1);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("trial");

  // OTP State
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // UI Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (step === 2 && countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Step 1: Submit Form & Trigger OTP Email via Resend
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg("Kata sandi minimal harus 6 karakter.");
      return;
    }

    setLoading(true);

    try {
      // Validasi server-side rate limit pendaftaran & kirim OTP via Resend
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim kode verifikasi.");
      }

      setStep(2);
      setCountdown(60);
      setCanResend(false);
      setOtpValues(["", "", "", "", "", ""]);
      setSuccessMsg(`Kode verifikasi 6 digit telah dikirim ke ${email.trim()}.`);

      // Focus first OTP input box
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses pendaftaran.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Email
  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim ulang OTP.");

      setCountdown(60);
      setCanResend(false);
      setSuccessMsg("Kode verifikasi baru telah dikirimkan ke email Anda.");
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit inputs
  const handleOtpChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const newValues = [...otpValues];

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newValues[i] = pasted[i] || "";
      }
      setOtpValues(newValues);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newValues[index] = cleaned.slice(-1);
    setOtpValues(newValues);

    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation between boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP and Login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpValues.join("");

    if (otpCode.length !== 6) {
      setErrorMsg("Harap masukkan 6 digit kode verifikasi lengkap.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 1. Verifikasi kode OTP melalui backend API
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otpCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memverifikasi kode OTP.");
      }

      // 2. Login ke sesi Supabase dengan kata sandi
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setSuccessMsg("Akun berhasil dibuat! Silakan masuk di halaman Login.");
        setTimeout(() => {
          router.push("/login");
        }, 1000);
        return;
      }

      setSuccessMsg("Verifikasi berhasil! Mengalihkan ke Workspace...");
      setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memverifikasi OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 animate-page-enter">
      <div className="w-full max-w-[400px] bg-bg-surface border border-border rounded-xl p-6 md:p-8 shadow-2xl">
        
        {/* ================= STEP 1: FORM PENDAFTARAN ================= */}
        {step === 1 && (
          <div className="animate-step-enter">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Daftar Akun Baru</h1>
              <p className="text-xs text-muted">Dapatkan kuota PRD gratis dan mulai generate sekarang.</p>
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

            <form onSubmit={handleSendOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-white mb-1" htmlFor="name">
                  Nama Lengkap
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="misal: Alex Pratama"
                  className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                />
              </div>

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
                <label className="block text-xs font-medium text-white mb-1" htmlFor="pwd">
                  Kata Sandi
                </label>
                <input
                  id="pwd"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1" htmlFor="plan">
                  Pilihan Paket Awal
                </label>
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none cursor-pointer"
                >
                  <option value="trial">Trial Gratis (3 Dokumen PRD)</option>
                  <option value="basic">Paket Basic (Rp 99.000 / bln)</option>
                  <option value="vip">Paket VIP (Rp 249.000 / bln - Rekomendasi)</option>
                  <option value="enterprise">Paket Enterprise (Tim & Agensi)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors mt-2"
              >
                {loading ? "Mengirim Kode..." : "Daftar & Kirim Kode OTP →"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-muted">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-indigo-400 font-medium hover:underline">
                Masuk di sini
              </Link>
            </div>
          </div>
        )}

        {/* ================= STEP 2: VERIFIKASI 6-DIGIT OTP ================= */}
        {step === 2 && (
          <div className="animate-step-enter">
            <div className="mb-5">
              <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Verifikasi Kode OTP</h1>
              <p className="text-xs text-muted leading-relaxed">
                Masukkan 6 digit kode verifikasi yang telah dikirim ke <strong className="text-white font-mono">{email}</strong>.
              </p>
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

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* 6 OTP Boxes */}
              <div className="flex justify-between gap-2">
                {otpValues.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-12 text-center text-lg font-bold font-mono bg-bg-input border border-border focus:border-primary-hover focus:ring-1 focus:ring-primary-hover rounded-lg text-white outline-none transition-all"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otpValues.join("").length !== 6}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
              >
                {loading ? "Memverifikasi..." : "Verifikasi & Buat Akun"}
              </button>

              {/* Resend & Edit Email Controls */}
              <div className="flex justify-between items-center text-xs pt-1 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted hover:text-white transition-colors"
                >
                  ← Ubah Email
                </button>

                <div>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                    >
                      Kirim Ulang Kode
                    </button>
                  ) : (
                    <span className="text-dim">
                      Kirim ulang ({countdown}s)
                    </span>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
