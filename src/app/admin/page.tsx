"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDateIndo } from "@/lib/utils";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  plan: "trial" | "basic" | "vip" | "enterprise";
  status: "active" | "banned";
  prd_count: number;
  created_at: string;
}

interface AIModel {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  min_tier: string;
  is_default: boolean;
  is_active: boolean;
}

interface DiscountCoupon {
  id: string;
  code: string;
  percentage: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  valid_until?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Permissions
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "pricing" | "settings" | "logs">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCoupon[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // User Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pricing Form State
  const [pricing, setPricing] = useState({
    basic_monthly: 99000,
    vip_monthly: 249000,
    enterprise_monthly: 799000,
    yearly_discount_pct: 20,
  });

  // Settings State
  const [aiSettings, setAiSettings] = useState({
    provider: "9router",
    base_url: "https://api.9router.com/v1",
    api_key: "",
    temperature: 0.7,
    max_tokens: 4096,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const [maintenanceSettings, setMaintenanceSettings] = useState({
    enabled: false,
    message: "Kami sedang melakukan peningkatan performa dan update model AI. PRDGen akan kembali aktif dalam beberapa menit.",
    eta: "24 Sep 2026, 18:00 WIB",
    allow_registration: true,
  });

  const [generalSettings, setGeneralSettings] = useState({
    site_name: "PRDGen",
    free_quota: 3,
    default_lang: "id",
  });

  // New Discount Form
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponPct, setNewCouponPct] = useState(20);
  const [newCouponLimit, setNewCouponLimit] = useState(100);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Auth Verification & Data Fetch
  useEffect(() => {
    async function checkAuthAndLoad() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        alert("Akses ditolak: Hanya administrator yang dapat mengakses halaman ini.");
        router.push("/app");
        return;
      }

      setIsAdmin(true);
      await fetchAllAdminData();
      setLoading(false);
    }

    checkAuthAndLoad();
  }, [router, supabase]);

  const fetchAllAdminData = async () => {
    try {
      // 1. Fetch Users
      const resUsers = await fetch("/api/admin/users");
      const dataUsers = await resUsers.json();
      if (dataUsers.users) setUsers(dataUsers.users);

      // 2. Fetch Models
      const resModels = await fetch("/api/admin/models");
      const dataModels = await resModels.json();
      if (dataModels.models) setModels(dataModels.models);

      // 3. Fetch Discounts
      const resDisc = await fetch("/api/admin/discounts");
      const dataDisc = await resDisc.json();
      if (dataDisc.discounts) setDiscounts(dataDisc.discounts);

      // 4. Fetch Logs
      const resLogs = await fetch("/api/admin/logs");
      const dataLogs = await resLogs.json();
      if (dataLogs.logs) setLogs(dataLogs.logs);

      // 5. Fetch Settings
      const resSettings = await fetch("/api/admin/settings");
      const dataSettings = await resSettings.json();
      if (dataSettings.settings) {
        dataSettings.settings.forEach((s: any) => {
          if (s.key === "ai_config") setAiSettings((prev) => ({ ...prev, ...s.value }));
          if (s.key === "maintenance_mode") setMaintenanceSettings((prev) => ({ ...prev, ...s.value }));
          if (s.key === "pricing_plans") setPricing((prev) => ({ ...prev, ...s.value }));
          if (s.key === "general_settings") setGeneralSettings((prev) => ({ ...prev, ...s.value }));
        });
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    }
  };

  // User Actions
  const handleToggleBan = async (userItem: UserProfile) => {
    const nextStatus = userItem.status === "banned" ? "active" : "banned";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userItem.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status user");

      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, status: nextStatus } : u))
      );
      showToast(`User ${userItem.full_name || userItem.email} berhasil ${nextStatus === "banned" ? "di-ban" : "di-unban"}.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChangePlan = async (userId: string, newPlan: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, plan: newPlan }),
      });
      if (!res.ok) throw new Error("Gagal mengubah paket user");

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan as any } : u))
      );
      showToast("Paket user berhasil diperbarui.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus akun ${name}? Seluruh PRD milik user ini akan ikut terhapus permanen.`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      if (!res.ok) throw new Error("Gagal menghapus user");

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast(`User ${name} telah dihapus.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Pricing & Coupon Actions
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "pricing_plans", value: pricing }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan harga");
      showToast("Harga paket langganan berhasil disimpan!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;

    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: newCouponCode.trim().toUpperCase(),
          percentage: newCouponPct,
          maxUses: newCouponLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kupon");

      setDiscounts((prev) => [data.discount, ...prev]);
      setNewCouponCode("");
      showToast(`Promo ${data.discount.code} berhasil dibuat!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleCoupon = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_active", id, is_active: !currentActive }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status kupon");

      setDiscounts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d))
      );
      showToast("Status kupon diperbarui.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    if (!confirm(`Hapus kupon promo ${code}?`)) return;
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) throw new Error("Gagal menghapus kupon");

      setDiscounts((prev) => prev.filter((d) => d.id !== id));
      showToast(`Promo ${code} telah dihapus.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // AI & Maintenance Settings
  const handleSaveAISettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ai_config", value: aiSettings }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan konfigurasi AI");
      showToast("Pengaturan AI 9router berhasil disimpan!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestAI = async () => {
    setTestLoading(true);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: aiSettings.base_url,
          apiKey: aiSettings.api_key,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Koneksi 9router Berhasil! (${data.latencyMs}ms)`);
      } else {
        alert(data.responseMessage || "Gagal tes koneksi ke 9router.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "maintenance_mode", value: maintenanceSettings }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan status maintenance");
      showToast(`Status sistem disimpan. Maintenance: ${maintenanceSettings.enabled ? "AKTIF" : "NONAKTIF"}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "general_settings", value: generalSettings }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan pengaturan umum");
      showToast("Pengaturan umum platform berhasil disimpan!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // AI Models Actions
  const handleAddModel = async () => {
    const name = prompt("Nama Tampilan Model (misal: GPT-4o Mini):");
    if (!name) return;
    const modelId = prompt("Model ID / String API (misal: gpt-4o-mini):");
    if (!modelId) return;
    const provider = prompt("Provider (misal: OpenAI / Google / Anthropic):", "9router");
    const minTier = prompt("Minimal Akses Paket (trial / basic / vip / enterprise):", "basic");

    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          modelId: modelId.trim(),
          provider: provider || "9router",
          minTier: minTier || "basic",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah model");

      setModels((prev) => [...prev, data.model]);
      showToast(`Model ${data.model.name} berhasil ditambahkan.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetDefaultModel = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_default", id }),
      });
      if (!res.ok) throw new Error("Gagal mengubah default model");

      setModels((prev) =>
        prev.map((m) => ({ ...m, is_default: m.id === id, is_active: m.id === id ? true : m.is_active }))
      );
      showToast(`Model default diubah ke: ${name}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteModel = async (id: string, name: string) => {
    if (!confirm(`Hapus model AI ${name}?`)) return;
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) throw new Error("Gagal menghapus model");

      setModels((prev) => prev.filter((m) => m.id !== id));
      showToast(`Model ${name} telah dihapus.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export User CSV
  const exportUsersCSV = () => {
    const headers = ["ID", "Nama", "Email", "Role", "Paket", "Status", "PRD_Dibuat", "Tanggal_Daftar"];
    const rows = users.map((u) => [
      u.id,
      `"${u.full_name || ""}"`,
      u.email,
      u.role,
      u.plan,
      u.status,
      u.prd_count,
      u.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Data user berhasil diekspor ke CSV!");
  };

  const filteredUsers = users.filter((u) => {
    const matchQ =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === "all" || u.plan === planFilter;
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchQ && matchPlan && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-xs text-muted">
        Memverifikasi hak akses administrator...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-56px)] bg-[#090a0f] animate-page-enter">
      
      {/* TOPBAR ADMIN */}
      <header className="h-14 bg-bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Hamburger Mobile Toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 border border-border rounded-md text-muted hover:text-white"
            aria-label="Toggle Sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/" className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
            PRD<span className="text-primary-hover">Gen</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-medium border border-indigo-500/30">
              Admin
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <Link href="/" className="text-muted hover:text-white transition-colors">
            Beranda
          </Link>
        </div>
      </header>

      <div className="flex-1 flex relative">
        
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR ADMIN */}
        <aside
          className={`w-60 bg-[#0d0f18] border-r border-border p-3 flex flex-col gap-1 flex-shrink-0 z-50 fixed md:static top-14 bottom-0 transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div
            onClick={() => { setActiveTab("overview"); setSidebarOpen(false); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "overview" ? "bg-bg-surface text-white border border-border font-semibold" : "text-muted hover:bg-bg-surface hover:text-white"
            }`}
          >
            Ringkasan
          </div>
          <div
            onClick={() => { setActiveTab("users"); setSidebarOpen(false); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors flex justify-between items-center ${
              activeTab === "users" ? "bg-bg-surface text-white border border-border font-semibold" : "text-muted hover:bg-bg-surface hover:text-white"
            }`}
          >
            <span>Kelola User</span>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full">{users.length}</span>
          </div>
          <div
            onClick={() => { setActiveTab("pricing"); setSidebarOpen(false); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "pricing" ? "bg-bg-surface text-white border border-border font-semibold" : "text-muted hover:bg-bg-surface hover:text-white"
            }`}
          >
            Harga & Diskon
          </div>
          <div
            onClick={() => { setActiveTab("settings"); setSidebarOpen(false); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "settings" ? "bg-bg-surface text-white border border-border font-semibold" : "text-muted hover:bg-bg-surface hover:text-white"
            }`}
          >
            Pengaturan (AI & Sistem)
          </div>
          <div
            onClick={() => { setActiveTab("logs"); setSidebarOpen(false); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "logs" ? "bg-bg-surface text-white border border-border font-semibold" : "text-muted hover:bg-bg-surface hover:text-white"
            }`}
          >
            Log Aktivitas
          </div>
        </aside>

        {/* ADMIN CONTENT CANVAS */}
        <main className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto min-w-0">
            
            {/* ==================== TAB 1: RINGKASAN ==================== */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Ringkasan Platform</h1>
                    <p className="text-xs text-muted">Statistik database pengguna real-time dan metrik penggunaan AI.</p>
                  </div>
                  <button
                    onClick={exportUsersCSV}
                    className="px-3.5 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-medium rounded-lg"
                  >
                    Download Data User (.CSV)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-bg-surface border border-border rounded-xl p-4">
                    <div className="text-xs text-muted mb-1">Total User Terdaftar</div>
                    <div className="text-2xl font-bold text-white">{users.length}</div>
                    <div className="text-[11px] text-emerald-400 mt-1">Real database profile</div>
                  </div>
                  <div className="bg-bg-surface border border-border rounded-xl p-4">
                    <div className="text-xs text-muted mb-1">Total PRD Digenerate</div>
                    <div className="text-2xl font-bold text-white">
                      {users.reduce((sum, u) => sum + (u.prd_count || 0), 0)}
                    </div>
                    <div className="text-[11px] text-indigo-400 mt-1">Akumulasi seluruh user</div>
                  </div>
                  <div className="bg-bg-surface border border-border rounded-xl p-4">
                    <div className="text-xs text-muted mb-1">Model AI Aktif</div>
                    <div className="text-2xl font-bold text-white">
                      {models.filter((m) => m.is_active).length}
                    </div>
                    <div className="text-[11px] text-dim mt-1">Tersedia via 9router</div>
                  </div>
                  <div className="bg-bg-surface border border-border rounded-xl p-4">
                    <div className="text-xs text-muted mb-1">Status Maintenance</div>
                    <div className={`text-2xl font-bold ${maintenanceSettings.enabled ? "text-amber-400" : "text-emerald-400"}`}>
                      {maintenanceSettings.enabled ? "AKTIF" : "NORMAL"}
                    </div>
                    <div className="text-[11px] text-dim mt-1">
                      {maintenanceSettings.enabled ? "Akses publik dibatasi" : "Publik dapat akses"}
                    </div>
                  </div>
                </div>

                {/* Quick Logs */}
                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <div className="text-sm font-semibold text-white mb-1">Aktivitas Sistem Terkini</div>
                  <div className="text-xs text-muted mb-4">Catatan log aksi administrator & generasi dokumen.</div>
                  <ul className="space-y-2 text-xs">
                    {logs.slice(0, 5).map((l, idx) => (
                      <li key={l.id || idx} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-none">
                        <span className="text-muted">{l.action}: {JSON.stringify(l.details || {})}</span>
                        <span className="text-[11px] text-dim whitespace-nowrap">{formatDateIndo(l.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ==================== TAB 2: KELOLA USER ==================== */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Kelola User</h1>
                    <p className="text-xs text-muted">Cari, ubah paket, blokir (ban), atau hapus akun pengguna.</p>
                  </div>
                  <button
                    onClick={exportUsersCSV}
                    className="px-3.5 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-medium rounded-lg"
                  >
                    Ekspor CSV
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau email..."
                    className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                  />
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                  >
                    <option value="all">Semua Paket</option>
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="vip">VIP</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Aktif</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>

                {/* Table */}
                <div className="bg-bg-surface border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border bg-white/[0.02] text-dim uppercase text-[10px] tracking-wider">
                        <th className="p-3 font-semibold">User</th>
                        <th className="p-3 font-semibold">Paket</th>
                        <th className="p-3 font-semibold">PRD</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Daftar</th>
                        <th className="p-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-dim">
                            Tidak ada data user yang sesuai.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.015]">
                            <td className="p-3">
                              <div className="font-semibold text-white">{u.full_name || "Tanpa Nama"}</div>
                              <div className="text-[11px] text-dim">{u.email}</div>
                            </td>
                            <td className="p-3">
                              <select
                                value={u.plan}
                                onChange={(e) => handleChangePlan(u.id, e.target.value)}
                                className="px-2 py-1 bg-bg-input border border-border rounded text-[11px] text-white outline-none cursor-pointer"
                              >
                                <option value="trial">Trial</option>
                                <option value="basic">Basic</option>
                                <option value="vip">VIP</option>
                                <option value="enterprise">Enterprise</option>
                              </select>
                            </td>
                            <td className="p-3 text-muted">{u.prd_count || 0}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  u.status === "banned"
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {u.status === "banned" ? "Banned" : "Aktif"}
                              </span>
                            </td>
                            <td className="p-3 text-dim text-[11px]">{formatDateIndo(u.created_at)}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleToggleBan(u)}
                                  className={`px-2.5 py-1 border rounded text-[11px] font-medium transition-colors ${
                                    u.status === "banned"
                                      ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                                      : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                                  }`}
                                >
                                  {u.status === "banned" ? "Unban" : "Ban"}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.full_name || u.email)}
                                  className="px-2.5 py-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded text-[11px] font-medium transition-colors"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== TAB 3: HARGA & DISKON ==================== */}
            {activeTab === "pricing" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Harga Paket & Promo</h1>
                  <p className="text-xs text-muted">Ubah tarif langganan dan terbitkan kupon diskon.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* EDIT PRICING */}
                  <div className="bg-bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1">Ubah Tarif Paket (Bulanan)</h2>
                    <p className="text-xs text-muted mb-4">Pengaturan ini langsung tampil di halaman /pricing.</p>

                    <form onSubmit={handleSavePricing} className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Paket Basic (Rp)</label>
                        <input
                          type="number"
                          value={pricing.basic_monthly}
                          onChange={(e) => setPricing({ ...pricing, basic_monthly: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Paket VIP (Rp)</label>
                        <input
                          type="number"
                          value={pricing.vip_monthly}
                          onChange={(e) => setPricing({ ...pricing, vip_monthly: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Paket Enterprise (Rp)</label>
                        <input
                          type="number"
                          value={pricing.enterprise_monthly}
                          onChange={(e) => setPricing({ ...pricing, enterprise_monthly: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors mt-2"
                      >
                        Simpan Perubahan Harga
                      </button>
                    </form>
                  </div>

                  {/* CREATE COUPON */}
                  <div className="bg-bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1">Buat Kupon Diskon Baru</h2>
                    <p className="text-xs text-muted mb-4">Terbitkan voucher potongan harga untuk user.</p>

                    <form onSubmit={handleCreateCoupon} className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Kode Promo</label>
                        <input
                          type="text"
                          required
                          value={newCouponCode}
                          onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                          placeholder="misal: PROMO2026"
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none uppercase font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Besar Potongan (%)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={newCouponPct}
                          onChange={(e) => setNewCouponPct(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Kuota Pemakaian</label>
                        <input
                          type="number"
                          min={1}
                          value={newCouponLimit}
                          onChange={(e) => setNewCouponLimit(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors mt-2"
                      >
                        + Terbitkan Kupon
                      </button>
                    </form>
                  </div>
                </div>

                {/* COUPONS LIST TABLE */}
                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <div className="text-sm font-semibold text-white mb-3">Daftar Promo Diskon Aktif</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-border text-dim uppercase text-[10px]">
                          <th className="pb-2 font-semibold">Kode</th>
                          <th className="pb-2 font-semibold">Potongan</th>
                          <th className="pb-2 font-semibold">Terpakai / Kuota</th>
                          <th className="pb-2 font-semibold">Status</th>
                          <th className="pb-2 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {discounts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-dim">
                              Belum ada kupon promo aktif.
                            </td>
                          </tr>
                        ) : (
                          discounts.map((d) => (
                            <tr key={d.id}>
                              <td className="py-2.5 font-bold font-mono text-white">{d.code}</td>
                              <td className="py-2.5 text-emerald-400 font-semibold">{d.percentage}% OFF</td>
                              <td className="py-2.5 text-muted">{d.current_uses} / {d.max_uses}</td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${d.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                  {d.is_active ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleCoupon(d.id, d.is_active)}
                                    className="px-2.5 py-1 border border-border rounded text-[11px] text-muted hover:text-white"
                                  >
                                    {d.is_active ? "Nonaktifkan" : "Aktifkan"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCoupon(d.id, d.code)}
                                    className="px-2.5 py-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded text-[11px]"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: PENGATURAN (AI & SISTEM) ==================== */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Pengaturan Sistem & AI</h1>
                  <p className="text-xs text-muted">Konfigurasi 9router API Gateway, manajemen model AI, dan mode pemeliharaan.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 1. 9ROUTER CONFIG */}
                  <div className="bg-bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1">Konfigurasi AI 9router</h2>
                    <p className="text-xs text-muted mb-4">Base URL dan API key disimpan aman di database server.</p>

                    <form onSubmit={handleSaveAISettings} className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Base URL 9router / Gateway</label>
                        <input
                          type="text"
                          required
                          value={aiSettings.base_url}
                          onChange={(e) => setAiSettings({ ...aiSettings, base_url: e.target.value })}
                          placeholder="https://api.9router.com/v1"
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">API Key 9router</label>
                        <div className="flex gap-1.5">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={aiSettings.api_key}
                            onChange={(e) => setAiSettings({ ...aiSettings, api_key: e.target.value })}
                            placeholder="Masukkan 9router API Key..."
                            className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-xs text-muted hover:text-white"
                          >
                            {showApiKey ? "Tutup" : "Lihat"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-muted mb-1">Temperature</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={aiSettings.temperature}
                            onChange={(e) => setAiSettings({ ...aiSettings, temperature: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">Max Tokens</label>
                          <input
                            type="number"
                            step="256"
                            value={aiSettings.max_tokens}
                            onChange={(e) => setAiSettings({ ...aiSettings, max_tokens: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Simpan API Key
                        </button>
                        <button
                          type="button"
                          onClick={handleTestAI}
                          disabled={testLoading}
                          className="px-4 py-2.5 bg-bg-input hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                        >
                          {testLoading ? "Menguji..." : "Tes Koneksi"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* 2. MAINTENANCE MODE */}
                  <div className="bg-bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1">Mode Pemeliharaan (Maintenance)</h2>
                    <p className="text-xs text-muted mb-4">Batasi akses publik sementara saat perbaikan sistem.</p>

                    <form onSubmit={handleSaveMaintenance} className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-bg-input border border-border rounded-lg">
                        <div>
                          <div className="text-xs font-semibold text-white">Status Maintenance</div>
                          <div className="text-[11px] text-muted">
                            {maintenanceSettings.enabled ? "Website sedang maintenance" : "Website beroperasi normal"}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={maintenanceSettings.enabled}
                          onChange={(e) => setMaintenanceSettings({ ...maintenanceSettings, enabled: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">Pesan untuk Pengunjung</label>
                        <textarea
                          rows={2}
                          value={maintenanceSettings.message}
                          onChange={(e) => setMaintenanceSettings({ ...maintenanceSettings, message: e.target.value })}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">Estimasi Selesai (WIB)</label>
                        <input
                          type="text"
                          value={maintenanceSettings.eta}
                          onChange={(e) => setMaintenanceSettings({ ...maintenanceSettings, eta: e.target.value })}
                          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors mt-2"
                      >
                        Simpan Status Sistem
                      </button>
                    </form>
                  </div>
                </div>

                {/* 3. AI MODELS LIST */}
                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Daftar Model AI</div>
                      <div className="text-xs text-muted">Model bahasa yang didukung untuk generator PRD.</div>
                    </div>
                    <button
                      onClick={handleAddModel}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg"
                    >
                      + Tambah Model
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-border text-dim uppercase text-[10px]">
                          <th className="pb-2 font-semibold">Nama Model</th>
                          <th className="pb-2 font-semibold">Model ID</th>
                          <th className="pb-2 font-semibold">Provider</th>
                          <th className="pb-2 font-semibold">Min Tier</th>
                          <th className="pb-2 font-semibold">Status</th>
                          <th className="pb-2 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {models.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2.5 font-semibold text-white">
                              {m.name}{" "}
                              {m.is_default && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-medium ml-1">
                                  Default
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-indigo-300">{m.model_id}</td>
                            <td className="py-2.5 text-muted">{m.provider}</td>
                            <td className="py-2.5 text-muted uppercase text-[11px]">{m.min_tier}</td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                {m.is_active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex justify-end gap-1.5">
                                {!m.is_default && (
                                  <button
                                    onClick={() => handleSetDefaultModel(m.id, m.name)}
                                    className="px-2 py-1 border border-border rounded text-[10px] text-muted hover:text-white"
                                  >
                                    Set Default
                                  </button>
                                )}
                                {!m.is_default && (
                                  <button
                                    onClick={() => handleDeleteModel(m.id, m.name)}
                                    className="px-2 py-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded text-[10px]"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. GENERAL PLATFORM SETTINGS */}
                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-white mb-1">Pengaturan Umum Platform</h2>
                  <p className="text-xs text-muted mb-4">Parameter dasar operasional dan kuota bawaan pengguna.</p>

                  <form onSubmit={handleSaveGeneral} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Nama Brand / Website</label>
                      <input
                        type="text"
                        value={generalSettings.site_name}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, site_name: e.target.value })}
                        className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Kuota Trial Gratis</label>
                      <input
                        type="number"
                        min={1}
                        value={generalSettings.free_quota}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, free_quota: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-white text-xs outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Simpan Pengaturan
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ==================== TAB 5: LOG AKTIVITAS ==================== */}
            {activeTab === "logs" && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Log Aktivitas Sistem</h1>
                  <p className="text-xs text-muted">Audit trail seluruh aksi pengguna dan admin di platform.</p>
                </div>

                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <ul className="space-y-2.5 text-xs">
                    {logs.length === 0 ? (
                      <li className="text-center text-dim py-4">Belum ada log aktivitas tercatat.</li>
                    ) : (
                      logs.map((l, idx) => (
                        <li key={l.id || idx} className="p-3 bg-bg-input border border-border rounded-lg flex flex-col sm:flex-row justify-between gap-1">
                          <div>
                            <span className="font-semibold text-indigo-300">{l.action}</span>
                            <div className="text-[11px] text-muted font-mono mt-0.5">
                              {JSON.stringify(l.details || {})}
                            </div>
                          </div>
                          <span className="text-[11px] text-dim whitespace-nowrap">
                            {formatDateIndo(l.created_at)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#161928] border border-emerald-500/50 text-white px-4 py-2.5 rounded-lg text-xs font-medium shadow-2xl z-50 animate-fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
