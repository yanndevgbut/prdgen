"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (prof) {
          setProfile(prof);
          if (prof.role === "admin") {
            setIsAdmin(true);
          }
        }
      }
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    window.location.href = "/";
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between backdrop-blur-md bg-[#090a0f]/85 border-b border-white/[0.08]">
        {/* Brand */}
        <Link href="/" className="text-white font-bold text-lg tracking-tight">
          PRD<span className="text-primary-hover">Gen</span>
        </Link>

        {/* Desktop Links */}
        <ul className="hidden md:flex items-center gap-6 list-none text-sm font-medium text-muted">
          <li>
            <Link href="/" className="hover:text-white transition-colors">
              Beranda
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </li>
          <li>
            <Link href="/app" className="hover:text-white transition-colors">
              Workspace
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link href="/admin" className="text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
                Admin Panel
              </Link>
            </li>
          )}
        </ul>

        {/* Right Area: Hamburger Trigger & Quick Actions */}
        <div className="flex items-center gap-3">
          {!user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs font-medium text-muted hover:text-white transition-colors px-2 py-1"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Daftar
              </Link>
            </div>
          ) : (
            <span className="hidden sm:inline-block text-xs text-dim">
              {profile?.full_name || user?.email?.split("@")[0]}
            </span>
          )}

          {/* Hamburger Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg border border-border bg-bg-surface text-muted hover:text-white transition-colors flex items-center justify-center"
            aria-label="Toggle Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Hamburger Drawer Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs animate-backdrop-fade"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xs bg-[#0d0f18] border-l border-border h-full p-5 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto animate-drawer-slide">
            <div className="space-y-6">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="text-white font-bold text-base tracking-tight"
                >
                  PRD<span className="text-primary-hover">Gen</span>
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-muted hover:text-white p-1 rounded"
                  aria-label="Tutup Menu"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* User Profile Section in Menu */}
              {user ? (
                <div className="p-3.5 bg-bg-surface border border-border rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-bold text-white truncate">
                      {profile?.full_name || user.email?.split("@")[0] || "User"}
                    </div>
                    <span className="text-[10px] uppercase font-bold bg-primary/20 text-indigo-300 px-2 py-0.5 rounded border border-primary/30">
                      {profile?.plan || "Trial"}
                    </span>
                  </div>
                  <div className="text-[11px] text-dim truncate">{user.email}</div>
                  <div className="pt-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full py-1.5 bg-white/5 hover:bg-red-500/10 border border-border hover:border-red-500/40 text-red-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      Keluar (Logout)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-bg-surface border border-border rounded-xl space-y-2">
                  <div className="text-xs text-muted">Akses akun Anda untuk mengelola PRD:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="py-2 bg-bg-input hover:text-white border border-border text-muted text-xs font-medium rounded-lg text-center transition-colors"
                    >
                      Masuk
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMenuOpen(false)}
                      className="py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg text-center transition-colors"
                    >
                      Daftar
                    </Link>
                  </div>
                </div>
              )}

              {/* Navigation List */}
              <div className="space-y-1 text-sm font-medium">
                <div className="text-[11px] text-dim uppercase tracking-wider px-2 py-1 font-bold">
                  Navigasi
                </div>
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:text-white hover:bg-bg-surface transition-colors"
                >
                  <span>Beranda</span>
                </Link>
                <Link
                  href="/app"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:text-white hover:bg-bg-surface transition-colors"
                >
                  <span>Workspace PRD</span>
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:text-white hover:bg-bg-surface transition-colors"
                >
                  <span>Paket & Pricing</span>
                </Link>
                <Link
                  href="/#cara-kerja"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:text-white hover:bg-bg-surface transition-colors"
                >
                  <span>Cara Kerja</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-indigo-300 hover:text-white bg-indigo-950/30 border border-indigo-500/30 transition-colors"
                  >
                    <span>Admin Panel</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Footer in Drawer */}
            <div className="text-[11px] text-dim pt-4 border-t border-border text-center">
              PRDGen v1.0 • Powered by 9router AI
            </div>
          </div>
        </div>
      )}
    </>
  );
}
