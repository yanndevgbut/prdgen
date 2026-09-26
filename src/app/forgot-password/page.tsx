"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  // Step 1: Input Email, Step 2: Input 6-Digit OTP & New Password
  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  // Step 1: Request Password Reset OTP
  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Harap masukkan alamat email akun Anda.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan kode OTP reset.");
      }

      setStep(2);
      setCountdown(60);
      setCanResend(false);
      setOtpValues(["", "", "", "", "", ""]);
      setSuccessMsg(`Kode verifikasi 6 digit telah dikirim ke ${email.trim()}.`);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat meminta kode OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
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

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP & Update Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpValues.join("");

    if (otpCode.length !== 6) {
      setErrorMsg("Harap masukkan 6 digit kode OTP lengkap.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Kata sandi baru minimal harus 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otpCode,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengatur ulang kata sandi.");
      }

      setSuccessMsg("Kata sandi berhasil diubah! Mengalihkan ke halaman Login...");
      
      // Auto login dengan sandi baru jika memungkinkan
      try {
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: newPassword,
        });
      } catch (e) {}

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengatur ulang kata sandi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 animate-page-enter">
      <div className="w-full max-w-[380px] bg-bg-surface border border-border rounded-xl p-6 md:p-8 shadow-2xl">
        
        {/* ================= STEP 1: INPUT EMAIL ================= */}
        {step === 1 && (
          <div className="animate-step-enter">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Lupa Kata Sandi</h1>
              <p className="text-xs text-muted">
                Masukkan alamat email yang terdaftar untuk menerima kode verifikasi OTP.
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

            <form onSubmit={handleSendResetOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white mb-1" htmlFor="email">
                  Alamat Email Akun
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {loading ? "Mengirim Kode..." : "Kirim Kode OTP Reset →"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-muted">
              Ingat kata sandi Anda?{" "}
              <Link href="/login" className="text-indigo-400 font-medium hover:underline">
                Kembali ke Login
              </Link>
            </div>
          </div>
        )}

        {/* ================= STEP 2: VERIFIKASI OTP & SANDI BARU ================= */}
        {step === 2 && (
          <div className="animate-step-enter">
            <div className="mb-5">
              <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Atur Ulang Sandi</h1>
              <p className="text-xs text-muted leading-relaxed">
                Masukkan 6 digit kode OTP yang dikirim ke <strong className="text-white font-mono">{email}</strong> dan tentukan kata sandi baru.
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

            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* 6 OTP Boxes */}
              <div>
                <label className="block text-xs font-medium text-white mb-1.5 text-center">
                  Kode Verifikasi OTP
                </label>
                <div className="flex justify-between gap-1.5">
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
                      className="w-10 h-11 text-center text-base font-bold font-mono bg-bg-input border border-border focus:border-primary-hover focus:ring-1 focus:ring-primary-hover rounded-lg text-white outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1" htmlFor="new-pwd">
                  Kata Sandi Baru
                </label>
                <input
                  id="new-pwd"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1" htmlFor="conf-pwd">
                  Konfirmasi Kata Sandi
                </label>
                <input
                  id="conf-pwd"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpValues.join("").length !== 6}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
              >
                {loading ? "Memproses..." : "Simpan Kata Sandi Baru"}
              </button>

              {/* Controls */}
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
