"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Cek apakah akun di-ban
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user.id)
          .single();

        if (profile?.status === "banned") {
          await supabase.auth.signOut();
          setErrorMsg("Akun ini telah dinonaktifkan oleh administrator.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Berhasil masuk! Membuka Workspace...");
        setTimeout(() => {
          router.push("/app");
          router.refresh();
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal masuk. Periksa email dan password Anda.");
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

          <button
            type="submit"
            disabled={loading}
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
