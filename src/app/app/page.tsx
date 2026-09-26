"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateIndo } from "@/lib/utils";
import {
  DynamicQuestion,
  parseUserFlowsFromMarkdown,
  parseRoadmapFromMarkdown,
  ParsedUserFlow,
  ParsedRoadmapPhase,
} from "@/lib/ai/9router";
import { PromoUpgradeModal } from "@/components/promo-upgrade-modal";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShareAgentModal } from "@/components/share-agent-modal";

interface PRDRecord {
  id: string;
  title: string;
  description: string;
  mode: string;
  status: "draft" | "final";
  version: number;
  content_markdown: string;
  task_breakdown: Array<{ task: string; done: boolean }>;
  created_at: string;
  updated_at: string;
}

interface AIModelOption {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  min_tier: string;
  is_default: boolean;
  is_active: boolean;
}

const TIER_LEVELS: Record<string, number> = {
  trial: 1,
  basic: 2,
  vip: 3,
  enterprise: 4,
};

const PRESET_TEMPLATES = [
  {
    label: "Contoh E-Commerce",
    title: "Platform E-Commerce Multivendor",
    desc: "Marketplace web & mobile untuk penjual online buka toko digital, kelola stok produk, proses order. Pembeli bisa checkout pakai QRIS/Transfer bank dan lacak ongkir kurir otomatis.",
  },
  {
    label: "Contoh SaaS CRM",
    title: "B2B Sales Pipeline CRM",
    desc: "Aplikasi web SaaS untuk pantau prospek penjualan tim B2B, papan Kanban deal penjualan, email follow-up otomatis, dan grafik konversi bulanan.",
  },
  {
    label: "Contoh E-Wallet",
    title: "Aplikasi Fintech E-Wallet",
    desc: "Aplikasi mobile e-wallet untuk transfer uang instan sesama pengguna, bayar merchant via QRIS, top-up saldo via VA Bank, dan proteksi transaksi dengan biometrik.",
  },
  {
    label: "Contoh WhatsApp Bot",
    title: "Bot WhatsApp Code Execution & Admin Server",
    desc: "Bot WhatsApp berbasis Node.js Baileys untuk eksekusi script Python/JS di sandbox Docker terisolasi dan monitoring status server via pesan teks.",
  },
  {
    label: "Contoh EdTech LMS",
    title: "Platform Kursus Online & LMS Interaktif",
    desc: "Aplikasi web pembelajaran dengan video materi berbayar, kuis interaktif, sertifikat otomatis, dan ruang diskusi antar murid dan mentor.",
  },
  {
    label: "Contoh Logistik Fleet",
    title: "Sistem Manajemen Armada Logistik & Pengiriman",
    desc: "Platform pelacakan posisi truk ekspedisi secara real-time via GPS, jadwal pengiriman barang, manajemen biaya bensin, dan bukti serah terima digital.",
  },
];

const QUICK_REVISIONS = [
  "+ Alur Refund (Bab 7)",
  "+ Uji Beban di Roadmap",
  "+ Modul Notifikasi (Bab 6)",
  "+ Matriks Keamanan Data",
  "+ Detail Skema Database",
];

export default function WorkspacePage() {
  const router = useRouter();
  const supabase = createClient();

  // State Auth & Data
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [historyList, setHistoryList] = useState<PRDRecord[]>([]);
  const [activePrd, setActivePrd] = useState<PRDRecord | null>(null);

  // Stepper State (1: Input, 2: Q&A, 0: Generating/Loading, 3: Studio/Revisi, 4: Final)
  const [currentStep, setCurrentStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Menyusun dokumen PRD...");
  const [questionLoading, setQuestionLoading] = useState(false);

  // AI Models & Dropdown
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);

  // Studio Sub-Tab View (doc, flows, roadmap)
  const [activeStudioTab, setActiveStudioTab] = useState<"doc" | "flows" | "roadmap">("doc");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportDropdownOpenStep3, setExportDropdownOpenStep3] = useState(false);
  const [exportDropdownOpenStep4, setExportDropdownOpenStep4] = useState(false);

  // Form Step 1 (Clean slate - Empty by default)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  // Dynamic Questions (Step 2) & Pagination
  const [questions, setQuestions] = useState<DynamicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [questionPage, setQuestionPage] = useState(1); // Page 1: Q 1-5, Page 2: Q 6-10

  // Form Step 3 (Revision)
  const [revisionInput, setRevisionInput] = useState("");

  // Parsed Visual Views from Markdown
  const [parsedFlows, setParsedFlows] = useState<ParsedUserFlow[]>([]);
  const [parsedRoadmap, setParsedRoadmap] = useState<ParsedRoadmapPhase[]>([]);

  // Load User, Profile, History, & AI Models
  useEffect(() => {
    async function loadUserAndData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      // 1. Load Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (prof) setProfile(prof);

      // 2. Load History PRDs
      const { data: prds } = await supabase
        .from("prds")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });

      if (prds) setHistoryList(prds);

      // 3. Load Active AI Models
      try {
        const resModels = await fetch("/api/ai/models");
        const dataModels = await resModels.json();
        if (dataModels.models && dataModels.models.length > 0) {
          setModels(dataModels.models);
          const def = dataModels.models.find((m: AIModelOption) => m.is_default) || dataModels.models[0];
          setSelectedModelId(def.model_id);
        }
      } catch (err) {
        console.warn("Error loading models:", err);
      }
    }

    loadUserAndData();
  }, [router, supabase]);

  // Update parsed views when activePrd changes
  useEffect(() => {
    if (activePrd?.content_markdown) {
      setParsedFlows(parseUserFlowsFromMarkdown(activePrd.content_markdown));
      setParsedRoadmap(parseRoadmapFromMarkdown(activePrd.content_markdown));
    }
  }, [activePrd]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".dropdown-export-container")) {
        setExportDropdownOpenStep3(false);
        setExportDropdownOpenStep4(false);
      }
      if (!target.closest(".dropdown-model-container")) {
        setModelDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const isModelLocked = (minTier: string = "basic") => {
    const userPlanLevel = TIER_LEVELS[profile?.plan?.toLowerCase() || "trial"] || 1;
    const requiredLevel = TIER_LEVELS[minTier?.toLowerCase() || "basic"] || 1;
    return userPlanLevel < requiredLevel;
  };

  const handleSelectModel = (m: AIModelOption) => {
    if (isModelLocked(m.min_tier)) {
      setPromoModalOpen(true);
      showToast(`Model ${m.name} khusus untuk paket ${m.min_tier.toUpperCase()} ke atas.`);
    } else {
      setSelectedModelId(m.model_id);
    }
    setModelDropdownOpen(false);
  };

  const selectedModelObj = models.find((m) => m.model_id === selectedModelId) || models[0];

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setTitle(preset.title);
    setDescription(preset.desc);
  };

  // Navigating to Step 2: Fetch Tailored Dynamic Questions (5 to 10 questions)
  const handleProceedToStep2 = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Harap isi nama dan deskripsi ide produk terlebih dahulu.");
      return;
    }

    setQuestionLoading(true);
    setQuestionPage(1);
    setCurrentStep(2);

    try {
      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyiapkan pertanyaan AI");

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions);

        const initialAnswers: Record<string, string | string[]> = {};
        data.questions.forEach((q: DynamicQuestion) => {
          if (mode === "ai") {
            if (q.type === "single_select") {
              initialAnswers[q.id] = q.options && q.options.length > 0 ? q.options[0] : "";
            } else if (q.type === "multi_select") {
              initialAnswers[q.id] = q.options && q.options.length > 0 ? [q.options[0]] : [];
            } else {
              initialAnswers[q.id] = "";
            }
          } else {
            // Mode manual: start empty
            initialAnswers[q.id] = "";
          }
        });
        setAnswers(initialAnswers);
      }
    } catch (err: any) {
      console.warn("Using fallback questions:", err.message);
      const fallbackList: DynamicQuestion[] = [
        {
          id: "target_user",
          type: "text",
          question: "1. Siapa target pengguna utama dari produk ini?",
          placeholder: "Ketik target pengguna spesifik...",
        },
        {
          id: "core_problem",
          type: "text",
          question: "2. Apa masalah utama yang ingin diselesaikan?",
          placeholder: "Ketik masalah atau pain point utama...",
        },
        {
          id: "platform_type",
          type: "single_select",
          question: "3. Platform utama apa yang ingin diprioritaskan?",
          options: [
            "Aplikasi Web (Responsive Browser)",
            "Aplikasi Mobile (Android & iOS)",
            "Bot / API Backend Service",
            "Kombinasi Web & Mobile",
          ],
        },
        {
          id: "tech_stack",
          type: "single_select",
          question: "4. Framework dan teknologi yang ingin digunakan?",
          options: [
            "Next.js + Supabase (Web Modern)",
            "Flutter / React Native (Mobile App)",
            "Node.js API + PostgreSQL",
            "Python FastAPI + Cloud DB",
          ],
        },
        {
          id: "mvp_features",
          type: "multi_select",
          question: "5. Fitur utama apa saja yang wajib ada di rilis awal (MVP)?",
          options: [
            "Sistem Akun & Hak Akses",
            "Pencarian & Manajemen Data",
            "Pembayaran Otomatis",
            "Notifikasi Real-time",
            "Dashboard Ringkasan Admin",
          ],
        },
        {
          id: "third_party",
          type: "multi_select",
          question: "6. Integrasi pihak ketiga apa saja yang dibutuhkan?",
          options: [
            "Payment Gateway (QRIS / VA Bank)",
            "Layanan Notifikasi Email / WhatsApp",
            "Cloud File Storage",
            "API Kurir / Logistik",
          ],
        },
      ];
      setQuestions(fallbackList);
    } finally {
      setQuestionLoading(false);
    }
  };

  const handleSingleSelect = (questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleMultiSelect = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const currentList = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      if (currentList.includes(option)) {
        return {
          ...prev,
          [questionId]: currentList.filter((item) => item !== option),
        };
      } else {
        return {
          ...prev,
          [questionId]: [...currentList, option],
        };
      }
    });
  };

  // Generate PRD via Backend API (Full 14 Chapters + Roadmap)
  const handleGenerate = async () => {
    setLoading(true);
    setCurrentStep(0);
    setLoadingText("Menganalisis kebutuhan & preferensi arsitektur...");

    try {
      setTimeout(() => setLoadingText("Menyusun 14 Bab PRD & Roadmap Pengembangan..."), 900);

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        mode,
        modelOverride: selectedModelId,
        answers: answers,
      };

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate PRD");

      setActivePrd(data.prd);
      setHistoryList((prev) => [data.prd, ...prev.filter((p) => p.id !== data.prd.id)]);
      setCurrentStep(3);
      setActiveStudioTab("doc");
      showToast("PRD 14 Bab & Roadmap berhasil dibuat oleh AI!");
    } catch (err: any) {
      alert(err.message || "Gagal membuat PRD.");
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Revise PRD via Backend API
  const handleRevise = async (customInstruction?: string) => {
    const instructionToUse = customInstruction || revisionInput;
    if (!instructionToUse.trim() || !activePrd) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdId: activePrd.id,
          instruction: instructionToUse.trim(),
          modelOverride: selectedModelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal merevisi PRD");

      setActivePrd(data.prd);
      setHistoryList((prev) =>
        prev.map((p) => (p.id === data.prd.id ? data.prd : p))
      );
      setRevisionInput("");
      showToast(`Revisi PRD & Roadmap berhasil diterapkan (v${data.prd.version})!`);
    } catch (err: any) {
      alert(err.message || "Gagal menerapkan revisi.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!activePrd) return;
    try {
      const { data, error } = await supabase
        .from("prds")
        .update({ status: "final", updated_at: new Date().toISOString() })
        .eq("id", activePrd.id)
        .select()
        .single();

      if (error) throw error;

      setActivePrd(data);
      setHistoryList((prev) =>
        prev.map((p) => (p.id === data.id ? data : p))
      );
      setCurrentStep(4);
      showToast("Dokumen PRD telah difinalisasi!");
    } catch (err: any) {
      alert("Gagal memfinalisasi status PRD.");
      setCurrentStep(4);
    }
  };

  const loadPRD = (prd: PRDRecord) => {
    setActivePrd(prd);
    setTitle(prd.title);
    setDescription(prd.description);
    if (prd.status === "final") {
      setCurrentStep(4);
    } else {
      setCurrentStep(3);
    }
    setActiveStudioTab("doc");
    setSidebarOpen(false);
    showToast(`Dokumen "${prd.title}" dimuat.`);
  };

  const resetNew = () => {
    setActivePrd(null);
    setTitle("");
    setDescription("");
    setAnswers({});
    setQuestions([]);
    setCurrentStep(1);
    setSidebarOpen(false);
  };

  // Delete PRD from history
  const handleDeleteHistory = async (e: React.MouseEvent, prdId: string, prdTitle: string) => {
    e.stopPropagation();
    if (!confirm(`Hapus dokumen "${prdTitle}" dari riwayat?`)) return;

    try {
      const { error } = await supabase.from("prds").delete().eq("id", prdId);
      if (error) throw error;

      setHistoryList((prev) => prev.filter((p) => p.id !== prdId));
      if (activePrd?.id === prdId) {
        resetNew();
      }
      showToast(`Dokumen "${prdTitle}" berhasil dihapus.`);
    } catch (err: any) {
      alert("Gagal menghapus dokumen PRD: " + err.message);
    }
  };

  const copyToClipboard = () => {
    if (!activePrd?.content_markdown) return;
    navigator.clipboard.writeText(activePrd.content_markdown).then(() => {
      showToast("Teks PRD berhasil disalin ke clipboard!");
    });
  };

  const downloadMarkdown = () => {
    if (!activePrd) return;
    const blob = new Blob([activePrd.content_markdown], {
      type: "text/markdown;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanName = (activePrd.title || "PRD").replace(/\s+/g, "_");
    a.download = `${cleanName}_v${activePrd.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("File .md berhasil diunduh!");
  };

  // Question Pagination Calculations
  const totalQuestions = questions.length;
  const isPaginated = totalQuestions > 5;
  const currentQuestionsPage = isPaginated
    ? questionPage === 1
      ? questions.slice(0, 5)
      : questions.slice(5)
    : questions;

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-56px)] bg-[#090a0f]">
      
      {/* POP-UP IKLAN PROMO UNTUK USER TRIAL / UPGRADE PROMPT */}
      <PromoUpgradeModal
        userPlan={profile?.plan}
        prdCount={profile?.prd_count}
        isOpenControlled={promoModalOpen}
        onCloseControlled={() => setPromoModalOpen(false)}
      />

      <div className="flex-1 flex relative">
        
        {/* Backdrop Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR RIWAYAT DENGAN FITUR DELETE */}
        <aside
          className={`w-64 bg-[#0d0f18] border-r border-border p-4 flex flex-col gap-4 flex-shrink-0 z-50 fixed md:static top-14 bottom-0 transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <button
            onClick={resetNew}
            className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + PRD Baru
          </button>

          <div className="flex-1 overflow-y-auto">
            <div className="text-[11px] font-bold text-dim uppercase tracking-wider mb-2">
              Riwayat PRD ({historyList.length})
            </div>
            {historyList.length === 0 ? (
              <div className="text-xs text-dim py-4 text-center">Belum ada PRD tersimpan</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {historyList.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => loadPRD(item)}
                    className={`group p-2.5 rounded-lg cursor-pointer transition-colors border flex items-center justify-between ${
                      activePrd?.id === item.id
                        ? "bg-bg-surface border-border text-white font-medium"
                        : "border-transparent text-muted hover:bg-bg-surface hover:text-white"
                    }`}
                  >
                    <div className="truncate flex-1 min-w-0 pr-2">
                      <div className="truncate font-medium">{item.title || "Untitled PRD"}</div>
                      <div className="text-[10px] text-dim flex justify-between mt-0.5">
                        <span>v{item.version} • {item.status}</span>
                        <span>{formatDateIndo(item.updated_at || item.created_at)}</span>
                      </div>
                    </div>

                    {/* Tombol Hapus Riwayat */}
                    <button
                      onClick={(e) => handleDeleteHistory(e, item.id, item.title || "Untitled PRD")}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-dim hover:text-red-300 rounded transition-all flex-shrink-0"
                      title="Hapus PRD"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* User Info / Quota */}
          <div className="p-3 bg-bg-surface border border-border rounded-lg text-xs">
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span className="font-semibold text-white truncate mr-2">
                {profile?.full_name || user?.email?.split("@")[0] || "User"}
              </span>
              <span className="text-indigo-400 uppercase text-[10px] font-bold flex-shrink-0">
                {profile?.plan || "Trial"}
              </span>
            </div>
            <div className="text-[10px] text-dim">
              {profile?.plan === "trial"
                ? `${profile?.prd_count || 0}/3 PRD dibuat (Trial)`
                : "Akses paket aktif"}
            </div>
          </div>
        </aside>

        {/* WORKSPACE MAIN CANVAS */}
        <main className="flex-1 min-w-0 p-4 md:p-8 flex justify-center overflow-y-auto">
          <div className="w-full max-w-3xl min-w-0">
            
            {/* Top Controls on Mobile */}
            <div className="flex items-center justify-between mb-4 md:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="px-3 py-1.5 bg-bg-surface border border-border text-muted hover:text-white rounded-md text-xs font-medium"
              >
                Riwayat ({historyList.length})
              </button>
              {activePrd && (
                <span className="text-xs text-dim truncate max-w-[180px]">
                  {activePrd.title} (v{activePrd.version})
                </span>
              )}
            </div>

            {/* STEP PROGRESS INDICATOR (CLEAN CIRCULAR NUMBERS ONLY) */}
            <div className="flex items-center justify-center gap-3 mb-8 text-xs">
              <div
                onClick={() => setCurrentStep(1)}
                className={`cursor-pointer transition-all ${
                  currentStep === 1
                    ? "scale-110"
                    : "opacity-75 hover:opacity-100"
                }`}
                title="Langkah 1: Ide Produk"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === 1
                    ? "bg-primary text-white shadow-lg shadow-indigo-600/30 ring-2 ring-primary/40"
                    : currentStep > 1
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-dim"
                }`}>1</span>
              </div>
              <span className="text-dim font-bold">›</span>

              <div
                onClick={() => title.trim() && description.trim() && setCurrentStep(2)}
                className={`cursor-pointer transition-all ${
                  currentStep === 2
                    ? "scale-110"
                    : "opacity-75 hover:opacity-100"
                }`}
                title="Langkah 2: Tanya Jawab"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === 2
                    ? "bg-primary text-white shadow-lg shadow-indigo-600/30 ring-2 ring-primary/40"
                    : currentStep > 2
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-dim"
                }`}>2</span>
              </div>
              <span className="text-dim font-bold">›</span>

              <div
                onClick={() => activePrd && setCurrentStep(3)}
                className={`cursor-pointer transition-all ${
                  currentStep === 3
                    ? "scale-110"
                    : "opacity-75 hover:opacity-100"
                }`}
                title="Langkah 3: Studio & Revisi"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === 3
                    ? "bg-primary text-white shadow-lg shadow-indigo-600/30 ring-2 ring-primary/40"
                    : currentStep > 3
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-dim"
                }`}>3</span>
              </div>
              <span className="text-dim font-bold">›</span>

              <div
                onClick={() => activePrd && setCurrentStep(4)}
                className={`cursor-pointer transition-all ${
                  currentStep === 4
                    ? "scale-110"
                    : "opacity-75 hover:opacity-100"
                }`}
                title="Langkah 4: Selesai"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === 4
                    ? "bg-primary text-white shadow-lg shadow-indigo-600/30 ring-2 ring-primary/40"
                    : "bg-white/10 text-dim"
                }`}>4</span>
              </div>
            </div>

            {/* ================= STEP 1: INPUT KEBUTUHAN ================= */}
            {currentStep === 1 && (
              <div className="animate-step-enter">
                <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                  Ceritain ide produkmu
                </h1>
                <p className="text-sm text-muted mb-6">
                  Tulis konsep singkatnya. Nanti AI bantu susun struktur dokumen PRD 14 Bab & Roadmap lengkapnya.
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1.5">
                      Nama / Judul Produk
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="misal: TokoOnlineKu"
                      className="w-full px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1.5">
                      Deskripsi Kebutuhan
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Jelasin produk apa yang mau dibikin, fitur utamanya apa, dan target penggunanya siapa..."
                      rows={4}
                      className="w-full px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none resize-y leading-relaxed transition-colors"
                    />

                    {/* SWIPEABLE TEMPLATE PRESET CONTAINER */}
                    <div className="swipe-scroll gap-2 mt-2.5 pb-1">
                      {PRESET_TEMPLATES.map((preset, pIdx) => (
                        <button
                          type="button"
                          key={pIdx}
                          onClick={() => applyPreset(preset)}
                          className="flex-shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-border hover:border-text-dim text-muted hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI MODEL SELECTION DROPDOWN BUTTON */}
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1.5">
                      Pilihan Model AI
                    </label>

                    <div className="relative dropdown-model-container">
                      <button
                        type="button"
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        className="w-full p-3 bg-bg-input border border-border hover:border-text-dim rounded-lg text-left flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-2">
                            <span>{selectedModelObj ? selectedModelObj.name : "Pilih Model AI"}</span>
                            {selectedModelObj?.is_default && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-normal border border-indigo-500/30">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-dim mt-0.5">
                            {selectedModelObj?.provider || "9router AI Gateway"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-semibold text-muted bg-white/5 px-2 py-0.5 rounded border border-border">
                            {selectedModelObj?.min_tier || "Basic"}
                          </span>
                          <svg className={`w-4 h-4 text-muted transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {/* Dropdown Menu List */}
                      {modelDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#11131d] border border-border rounded-xl shadow-2xl p-1.5 z-30 animate-scale-in flex flex-col gap-1 max-h-60 overflow-y-auto">
                          {models.map((m) => {
                            const isSelected = selectedModelId === m.model_id;
                            const locked = isModelLocked(m.min_tier);
                            return (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => handleSelectModel(m)}
                                className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                                  isSelected
                                    ? "bg-primary/20 border-primary text-white font-medium"
                                    : locked
                                    ? "bg-bg-input/50 border-transparent text-muted opacity-75 hover:opacity-100 hover:bg-white/5"
                                    : "bg-transparent border-transparent text-muted hover:bg-white/5 hover:text-white"
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                    <span>{m.name}</span>
                                    {m.is_default && (
                                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-dim">{m.provider}</div>
                                </div>

                                <div>
                                  {locked ? (
                                    <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                                      {m.min_tier} Only
                                    </span>
                                  ) : isSelected ? (
                                    <span className="text-primary-hover text-xs font-bold flex items-center gap-1">
                                      <svg className="w-3 h-3 text-primary-hover" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Terpilih</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-dim capitalize">{m.min_tier}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MODE SELECTION */}
                  <div>
                    <label className="block text-xs font-semibold text-white mb-2">
                      Pilihan Mode Pengisian
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setMode("ai")}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          mode === "ai"
                            ? "bg-[#131627] border-primary"
                            : "bg-bg-input border-border hover:border-text-dim"
                        }`}
                      >
                        <div className="flex gap-2.5 items-start">
                          <input
                            type="radio"
                            name="mode"
                            checked={mode === "ai"}
                            onChange={() => setMode("ai")}
                            className="mt-0.5 accent-primary cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white">Tanya Jawab AI</div>
                            <div className="text-[11px] text-muted leading-tight mt-0.5">
                              AI menganalisis ide produk dan memberikan opsi rekomendasi instan.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => setMode("manual")}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          mode === "manual"
                            ? "bg-[#131627] border-primary"
                            : "bg-bg-input border-border hover:border-text-dim"
                        }`}
                      >
                        <div className="flex gap-2.5 items-start">
                          <input
                            type="radio"
                            name="mode"
                            checked={mode === "manual"}
                            onChange={() => setMode("manual")}
                            className="mt-0.5 accent-primary cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white">Isi Sendiri</div>
                            <div className="text-[11px] text-muted leading-tight mt-0.5">
                              Pertanyaan disesuaikan dengan produk, diisi manual secara bebas.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8 pt-4 border-t border-border">
                  <button
                    onClick={handleProceedToStep2}
                    className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Lanjut ke Tanya Jawab →
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 2: TANYA JAWAB (PAGINATED & FOCUSED QUESTIONS) ================= */}
            {currentStep === 2 && (
              <div className="animate-step-enter">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Pertanyaan Tambahan
                  </h1>
                  {isPaginated && (
                    <span className="text-[11px] bg-white/5 border border-border px-2.5 py-1 rounded-md text-dim font-medium">
                      Halaman {questionPage} dari 2 (Soal {questionPage === 1 ? "1–5" : `6–${totalQuestions}`})
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mb-6">
                  {mode === "ai"
                    ? "Pertanyaan di bawah disusun khusus oleh AI sesuai produk yang kamu masukkan:"
                    : "Ketik rincian spesifik sesuai dengan kebutuhan produk yang ingin dibuat:"}
                </p>

                {questionLoading ? (
                  <div className="py-16 text-center bg-bg-surface border border-border rounded-xl">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-primary-hover rounded-full animate-spin mx-auto mb-3" />
                    <div className="text-xs font-semibold text-white mb-1">AI sedang menganalisis ide produkmu...</div>
                    <div className="text-[11px] text-muted">Menyiapkan pertanyaan fokus satu per satu tanpa menggabungkan topik.</div>
                  </div>
                ) : questions.length > 0 ? (
                  <div className="space-y-4">
                    {currentQuestionsPage.map((q) => (
                      <div key={q.id} className="p-4 bg-bg-surface border border-border rounded-xl">
                        
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="text-xs font-semibold text-white">
                            {q.question}
                          </label>
                          <span className="text-[10px] text-dim px-2 py-0.5 bg-white/5 rounded border border-border">
                            {mode === "manual"
                              ? "Isi Manual"
                              : q.type === "text"
                              ? "Ketik Spesifik"
                              : q.type === "single_select"
                              ? "Pilih 1 Opsi"
                              : "Pilih Lebih dari 1"}
                          </span>
                        </div>

                        {/* MODE MANUAL: Semua pertanyaan disajikan sebagai input manual fleksibel */}
                        {mode === "manual" || q.type === "text" ? (
                          <input
                            type="text"
                            value={(answers[q.id] as string) || ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder={q.placeholder || "Ketik jawaban Anda di sini..."}
                            className="w-full px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                          />
                        ) : q.type === "single_select" && q.options ? (
                          /* TIPE 2 (AI Mode): SINGLE SELECT */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {q.options.map((opt, oIdx) => {
                              const isSelected = answers[q.id] === opt;
                              return (
                                <button
                                  type="button"
                                  key={oIdx}
                                  onClick={() => handleSingleSelect(q.id, opt)}
                                  className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                    isSelected
                                      ? "bg-primary border-primary text-white font-medium shadow-md shadow-indigo-600/25"
                                      : "bg-bg-input border-border text-muted hover:border-text-dim hover:text-white"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isSelected && (
                                    <svg className="w-3.5 h-3.5 text-white ml-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : q.type === "multi_select" && q.options ? (
                          /* TIPE 3 (AI Mode): MULTI SELECT */
                          <div className="swipe-scroll gap-2 mt-2 pb-1">
                            {q.options.map((opt, oIdx) => {
                              const currentSelected = Array.isArray(answers[q.id])
                                ? (answers[q.id] as string[])
                                : [];
                              const isSelected = currentSelected.includes(opt);
                              return (
                                <button
                                  type="button"
                                  key={oIdx}
                                  onClick={() => handleMultiSelect(q.id, opt)}
                                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs transition-all flex items-center gap-2 ${
                                    isSelected
                                      ? "bg-indigo-900/40 border-primary-hover text-indigo-200 font-medium"
                                      : "bg-bg-input border-border text-muted hover:border-text-dim hover:text-white"
                                  }`}
                                >
                                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? "bg-primary border-primary" : "border-border bg-bg-surface"
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                      </div>
                    ))}
                  </div>
                ) : null}

                {/* PAGINATION & ACTION BUTTONS */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 mt-8 pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      if (isPaginated && questionPage === 2) {
                        setQuestionPage(1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } else {
                        setCurrentStep(1);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                  >
                    {isPaginated && questionPage === 2 ? "← Halaman 1 (Soal 1–5)" : "← Kembali"}
                  </button>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {/* If on page 1 and paginated, show next page button */}
                    {isPaginated && questionPage === 1 ? (
                      <>
                        <button
                          disabled={questionLoading}
                          onClick={handleGenerate}
                          className="w-full sm:w-auto px-4 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                        >
                          Lewati & Bikin PRD
                        </button>
                        <button
                          disabled={questionLoading}
                          onClick={() => {
                            setQuestionPage(2);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
                        >
                          Lanjut ke Soal 6–{totalQuestions} →
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={questionLoading}
                          onClick={handleGenerate}
                          className="w-full sm:w-auto px-4 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                        >
                          Lewati & Bikin PRD
                        </button>
                        <button
                          disabled={questionLoading}
                          onClick={handleGenerate}
                          className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
                        >
                          Generate PRD Sekarang
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 0: LOADING SCREEN ================= */}
            {currentStep === 0 && (
              <div className="py-20 text-center animate-step-enter">
                <div className="w-10 h-10 border-3 border-white/10 border-t-primary-hover rounded-full animate-spin mx-auto mb-4" />
                <h2 className="text-lg font-bold text-white mb-1">{loadingText}</h2>
                <p className="text-xs text-muted">9router AI sedang menyusun spesifikasi dokumen PRD 14 Bab & Roadmap.</p>
              </div>
            )}

            {/* ================= STEP 3: STUDIO & REVISI ================= */}
            {currentStep === 3 && activePrd && (
              <div className="animate-step-enter">
                <div className="flex justify-between items-center mb-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight">Studio PRD & Roadmap</h1>
                  <span className="text-[11px] bg-primary/20 text-indigo-300 font-semibold px-2 py-0.5 rounded">
                    Draf v{activePrd.version}
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">
                  Tinjau dokumen PRD lengkap, alur pengguna interaktif, dan roadmap sprint. AI siap merevisi seluruh bagian kapan saja.
                </p>

                {/* Revision Bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    value={revisionInput}
                    onChange={(e) => setRevisionInput(e.target.value)}
                    placeholder="misal: Prioritaskan integrasi payment gateway di Sprint 1, tambah alur refund..."
                    className="flex-1 px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleRevise()}
                  />
                  <button
                    disabled={loading || !revisionInput.trim()}
                    onClick={() => handleRevise()}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {loading ? "Memproses..." : "Kirim Revisi AI"}
                  </button>
                </div>

                {/* SWIPEABLE QUICK REVISION CHIPS */}
                <div className="swipe-scroll gap-2 mb-5 pb-1">
                  {QUICK_REVISIONS.map((revText, rIdx) => (
                    <button
                      type="button"
                      key={rIdx}
                      onClick={() => handleRevise(revText.replace(/^\+\s*/, ""))}
                      className="flex-shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-border hover:border-text-dim text-muted hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      {revText}
                    </button>
                  ))}
                </div>

                {/* SWIPEABLE STUDIO SUB-TABS */}
                <div className="swipe-scroll gap-2 border-b border-border pb-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("doc")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "doc"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Dokumen PRD (14 Bab)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("flows")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "flows"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Alur Pengguna (Flows)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("roadmap")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "roadmap"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Roadmap Pengembangan
                  </button>
                </div>

                {/* TAB 1: FULL PRD MARKDOWN */}
                {activeStudioTab === "doc" && (
                  <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-lg animate-step-enter">
                    <MarkdownRenderer content={activePrd.content_markdown} />
                  </div>
                )}

                {/* TAB 2: INTERACTIVE USER FLOWS */}
                {activeStudioTab === "flows" && (
                  <div className="space-y-4 animate-step-enter">
                    {parsedFlows.map((flow, fIdx) => (
                      <div key={fIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                        <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary-hover" />
                          <span>{flow.title}</span>
                        </div>
                        <div className="space-y-2.5">
                          {flow.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-3 text-xs text-muted">
                              <span className="w-5 h-5 rounded-full bg-bg-input border border-border flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <div className="p-2.5 bg-bg-input border border-border rounded-lg flex-1 leading-relaxed text-slate-200">
                                {step}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: VISUAL ROADMAP */}
                {activeStudioTab === "roadmap" && (
                  <div className="space-y-4 animate-step-enter">
                    {parsedRoadmap.map((phase, pIdx) => (
                      <div key={pIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                        <div className="flex justify-between items-start flex-wrap gap-2 mb-2 pb-2 border-b border-border">
                          <div>
                            <div className="text-sm font-bold text-white">{phase.phaseTitle}</div>
                            <div className="text-xs text-indigo-400 font-medium mt-0.5">{phase.timeline}</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-primary/20 text-indigo-300 rounded font-semibold border border-primary/30">
                            Fase {pIdx + 1}
                          </span>
                        </div>

                        {/* SWIPEABLE ROADMAP MILESTONES */}
                        {phase.milestones && phase.milestones.length > 0 && (
                          <div className="mb-3">
                            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-1.5">
                              Key Milestones:
                            </div>
                            <div className="swipe-scroll gap-1.5 pb-1">
                              {phase.milestones.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-white/5 border border-border rounded-md text-slate-300"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-1">
                            Deliverables & Task Sprint:
                          </div>
                          {phase.tasks.map((t, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-center gap-2 text-xs p-2 bg-bg-input border border-border rounded-lg text-muted"
                            >
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.done ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                                {t.done ? "Selesai" : "Proses"}
                              </span>
                              <span className={t.done ? "line-through text-dim" : "text-slate-200"}>
                                {t.task}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 mt-8 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                    >
                      Ubah Jawaban
                    </button>

                    {/* Step 3 Dropdown */}
                    <div className="relative flex-1 sm:flex-none dropdown-export-container">
                      <button
                        onClick={() => setExportDropdownOpenStep3(!exportDropdownOpenStep3)}
                        className="w-full px-4 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Opsi & Bagikan</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpenStep3 ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {exportDropdownOpenStep3 && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-56 bg-[#11131d] border border-border rounded-xl shadow-2xl p-1.5 z-30 animate-scale-in flex flex-col gap-0.5">
                          <button
                            onClick={() => { copyToClipboard(); setExportDropdownOpenStep3(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Salin Teks (Markdown)</span>
                          </button>
                          <button
                            onClick={() => { setShareModalOpen(true); setExportDropdownOpenStep3(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/40 rounded-lg flex items-center gap-2 transition-colors font-medium"
                          >
                            <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            <span>Share ke AI Agent</span>
                          </button>
                          <button
                            onClick={() => { downloadMarkdown(); setExportDropdownOpenStep3(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>Unduh Berkas (.md)</span>
                          </button>
                          <button
                            onClick={() => { window.print(); setExportDropdownOpenStep3(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 6 2 18 2 18 9" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <rect x="6" y="14" width="12" height="8" />
                            </svg>
                            <span>Cetak / Simpan PDF</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleFinalize}
                    className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Simpan & Finalkan Dokumen →
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 4: HASIL FINAL ================= */}
            {currentStep === 4 && activePrd && (
              <div className="animate-step-enter">
                <div className="flex justify-between items-center mb-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight">PRD Siap Dipakai</h1>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded">
                    Status: FINAL (v{activePrd.version})
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">
                  Dokumen telah difinalkan. Anda dapat menyalin teks atau mengunduh file untuk tim pengembang.
                </p>

                {/* Step 4 Action Bar */}
                <div className="flex justify-between items-center gap-3 mb-6 relative">
                  <button
                    onClick={resetNew}
                    className="px-4 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                  >
                    + Bikin PRD Baru
                  </button>

                  {/* Dropdown Ekspor & Bagikan */}
                  <div className="relative dropdown-export-container">
                    <button
                      onClick={() => setExportDropdownOpenStep4(!exportDropdownOpenStep4)}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      <span>Ekspor & Bagikan</span>
                      <svg className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpenStep4 ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {exportDropdownOpenStep4 && (
                      <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#11131d] border border-border rounded-xl shadow-2xl p-1.5 z-30 animate-scale-in flex flex-col gap-0.5">
                        <button
                          onClick={() => { copyToClipboard(); setExportDropdownOpenStep4(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          <span>Salin Teks (Markdown)</span>
                        </button>
                        <button
                          onClick={() => { setShareModalOpen(true); setExportDropdownOpenStep4(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/40 rounded-lg flex items-center gap-2.5 transition-colors font-medium"
                        >
                          <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                          <span>Share ke AI Agent</span>
                        </button>
                        <button
                          onClick={() => { downloadMarkdown(); setExportDropdownOpenStep4(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span>Unduh Berkas (.md)</span>
                        </button>
                        <button
                          onClick={() => { window.print(); setExportDropdownOpenStep4(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                          <span>Cetak / Simpan PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SWIPEABLE SUB-TABS ON FINAL STEP */}
                <div className="swipe-scroll gap-2 border-b border-border pb-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("doc")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "doc"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Dokumen PRD
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("flows")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "flows"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Alur Pengguna
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab("roadmap")}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeStudioTab === "roadmap"
                        ? "bg-primary text-white shadow-md shadow-indigo-600/20"
                        : "text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    Roadmap
                  </button>
                </div>

                {activeStudioTab === "doc" && (
                  <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-lg animate-step-enter">
                    <MarkdownRenderer content={activePrd.content_markdown} />
                  </div>
                )}

                {activeStudioTab === "flows" && (
                  <div className="space-y-4">
                    {parsedFlows.map((flow, fIdx) => (
                      <div key={fIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                        <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{flow.title}</span>
                        </div>
                        <div className="space-y-2.5">
                          {flow.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-3 text-xs text-muted">
                              <span className="w-5 h-5 rounded-full bg-bg-input border border-border flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <div className="p-2.5 bg-bg-input border border-border rounded-lg flex-1 leading-relaxed text-slate-200">
                                {step}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeStudioTab === "roadmap" && (
                  <div className="space-y-4">
                    {parsedRoadmap.map((phase, pIdx) => (
                      <div key={pIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                        <div className="flex justify-between items-start flex-wrap gap-2 mb-2 pb-2 border-b border-border">
                          <div>
                            <div className="text-sm font-bold text-white">{phase.phaseTitle}</div>
                            <div className="text-xs text-indigo-400 font-medium mt-0.5">{phase.timeline}</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-semibold border border-emerald-500/30">
                            Fase {pIdx + 1}
                          </span>
                        </div>

                        {phase.milestones && phase.milestones.length > 0 && (
                          <div className="mb-3">
                            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-1.5">
                              Key Milestones:
                            </div>
                            <div className="swipe-scroll gap-1.5 pb-1">
                              {phase.milestones.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-white/5 border border-border rounded-md text-slate-300"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 pt-1">
                          {phase.tasks.map((t, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-center gap-2 text-xs p-2 bg-bg-input border border-border rounded-lg text-muted"
                            >
                              <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span className="text-slate-200">{t.task}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* SHARE AGENT MODAL */}
      <ShareAgentModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        prdId={activePrd?.id || ""}
        prdTitle={activePrd?.title || ""}
        prdMarkdown={activePrd?.content_markdown || ""}
      />

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#161928] border border-emerald-500/50 text-white px-4 py-2.5 rounded-lg text-xs font-medium shadow-2xl z-50 animate-scale-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
