import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AIConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  defaultModel: string;
}

export interface DynamicQuestion {
  id: string;
  type: "text" | "single_select" | "multi_select";
  question: string;
  description?: string;
  options?: string[];
  placeholder?: string;
  defaultValue?: string | string[];
}

export interface ParsedUserFlow {
  title: string;
  steps: string[];
}

export interface ParsedRoadmapPhase {
  phaseTitle: string;
  timeline: string;
  milestones: string[];
  tasks: Array<{ task: string; done: boolean }>;
}

/**
 * Mengambil konfigurasi 9router secara dinamis dari database (system_settings),
 * dengan fallback ke environment variable server jika database belum memiliki setting.
 */
export async function getDynamicAIConfig(): Promise<AIConfig> {
  let baseUrl = process.env.NINEROUTER_BASE_URL || "https://api.9router.com/v1";
  let apiKey = process.env.NINEROUTER_API_KEY || "";
  let provider = "9router";
  let temperature = 0.7;
  let maxTokens = 6000;
  let defaultModel = "gemini-1.5-pro-latest";

  try {
    const supabase = createAdminClient();
    
    const { data: settingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "ai_config")
      .single();

    if (settingData?.value) {
      const val = settingData.value as any;
      if (val.base_url) baseUrl = val.base_url;
      if (val.api_key) apiKey = val.api_key;
      if (val.provider) provider = val.provider;
      if (val.temperature !== undefined) temperature = Number(val.temperature);
      if (val.max_tokens !== undefined) maxTokens = Number(val.max_tokens);
    }

    const { data: modelData } = await supabase
      .from("ai_models")
      .select("model_id")
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (modelData?.model_id) {
      defaultModel = modelData.model_id;
    }
  } catch (error) {
    console.warn("Menggunakan fallback AI config karena DB belum terkonfigurasi:", error);
  }

  return {
    provider,
    baseUrl,
    apiKey,
    temperature,
    maxTokens,
    defaultModel,
  };
}

/**
 * Membuat instance OpenAI SDK yang diarahkan ke 9router AI Gateway
 */
export async function create9routerClient(customConfig?: Partial<AIConfig>) {
  const config = await getDynamicAIConfig();
  const finalBaseUrl = customConfig?.baseUrl || config.baseUrl;
  const finalApiKey = customConfig?.apiKey || config.apiKey;

  return {
    client: new OpenAI({
      baseURL: finalBaseUrl,
      apiKey: finalApiKey || "dummy-key-for-init",
    }),
    config: {
      ...config,
      ...customConfig,
    },
  };
}

/**
 * Menganalisis ide produk dan menghasilkan daftar pertanyaan pendukung dinamis (5-10 soal)
 * dengan aturan ketat:
 * 1. Bahasa sederhana dan mudah dimengerti
 * 2. 1 Konteks per soal (DILARANG menggabungkan 2 topik di satu soal)
 * 3. 3 Tipe: 'text' (ketik spesifik), 'single_select' (pilih 1 opsi), 'multi_select' (bisa pilih >1 opsi)
 */
export async function generateDynamicQuestions(params: {
  title: string;
  description: string;
  modelOverride?: string;
}): Promise<DynamicQuestion[]> {
  const { client, config } = await create9routerClient();
  const modelToUse = params.modelOverride || config.defaultModel;

  const systemPrompt = `Anda adalah Principal Product Manager dan System Analyst berpengalaman.
Tugas Anda adalah menganalisis ide produk yang diberikan pengguna, lalu membuat antara 5 sampai 10 pertanyaan pendukung yang SANGAT RELEVAN, SPESIFIK, dan DISESUAIKAN dengan produk tersebut.

ATURAN WAJIB PEMBUATAN SOAL:
1. BAHASA MUDAH DIMENGERTI: Gunakan bahasa Indonesia santai, jelas, dan tidak berbelit-belit.
2. 1 KONTEKS PER SOAL (STRICT): JANGAN PERNAH menggabungkan dua topik/pertanyaan dalam satu nomor soal (contoh SALAH: "Siapa target user dan apa masalahnya?" -> contoh BENAR: buat satu soal tentang target user, dan satu soal terpisah tentang masalah yang ingin diselesaikan).
3. JUMLAH PERTANYAAN: Buat antara 5 hingga 10 pertanyaan (sesuai kompleksitas produk).
4. VARIASI 3 TIPE SOAL:
   - type: "text" -> Pertanyaan yang butuh jawaban spesifik dan diketik manual.
   - type: "single_select" -> Pertanyaan pilihan tunggal dengan 4 opsi pilihan relevan. Pengguna hanya memilih 1 opsi.
   - type: "multi_select" -> Pertanyaan pilihan ganda dengan 4-6 opsi pilihan relevan. Pengguna bisa memilih lebih dari 1 opsi.
5. JANGAN GUNAKAN EMOJI SAMA SEKALI.

Format Output WAJIB HANYA berupa JSON valid array of objects (tanpa backtick markdown dan tanpa teks lain):
[
  {
    "id": "target_user",
    "type": "text",
    "question": "1. Siapa target pengguna utama dari produk ini?",
    "placeholder": "Contoh: Mahasiswa dan pekerja kantoran yang sering bepergian..."
  },
  {
    "id": "core_problem",
    "type": "text",
    "question": "2. Apa masalah utama yang ingin diselesaikan?",
    "placeholder": "Contoh: Pencatatan pengeluaran manual yang sering terlupa..."
  },
  {
    "id": "platform_type",
    "type": "single_select",
    "question": "3. Platform utama apa yang ingin diprioritaskan?",
    "options": [
      "Aplikasi Web (Desktop & Mobile Browser)",
      "Aplikasi Mobile (Android & iOS)",
      "Bot / CLI / Integrasi Chat API",
      "Kombinasi Web & Mobile App"
    ]
  },
  {
    "id": "tech_stack",
    "type": "single_select",
    "question": "4. Framework atau teknologi utama yang ingin digunakan?",
    "options": [
      "Next.js + Supabase (Fullstack Web)",
      "Flutter / React Native (Mobile App)",
      "Node.js API + PostgreSQL (Backend Service)",
      "Python FastAPI + Cloud Database"
    ]
  },
  {
    "id": "mvp_features",
    "type": "multi_select",
    "question": "5. Fitur utama apa saja yang wajib ada di rilis awal (MVP)?",
    "options": [
      "Sistem Daftar & Masuk Akun",
      "Pencarian & Filter Data",
      "Pembayaran Otomatis",
      "Notifikasi Pengingat",
      "Dashboard Statistik"
    ]
  },
  {
    "id": "third_party",
    "type": "multi_select",
    "question": "6. Integrasi layanan eksternal apa saja yang dibutuhkan?",
    "options": [
      "Payment Gateway (QRIS / Bank Transfer)",
      "Layanan Pengiriman / Kurir",
      "Email & WhatsApp Gateway",
      "Penyimpanan Cloud Storage"
    ]
  }
]`;

  const userPrompt = `Ide Produk Pengguna:
- Nama Produk: ${params.title}
- Deskripsi Kebutuhan: ${params.description}

Buatkan 5-10 pertanyaan terpandu (text, single_select, multi_select) dengan 1 konteks per soal khusus untuk produk ini tanpa emoji.`;

  try {
    const response = await client.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    });

    let raw = response.choices[0]?.message?.content?.trim() || "[]";
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (raw.startsWith("```")) {
      raw = raw.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsed: DynamicQuestion[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed;
    }
  } catch (error) {
    console.warn("Gagal parse dynamic questions dari 9router, menggunakan template fallback yang relevan:", error);
  }

  // Clean single-context fallback questions (6 focused questions)
  return [
    {
      id: "target_user",
      type: "text",
      question: "1. Siapa target pengguna utama dari produk ini?",
      placeholder: "Contoh: Pemilik bisnis online dan tim sales...",
      defaultValue: "",
    },
    {
      id: "core_problem",
      type: "text",
      question: "2. Apa masalah utama yang ingin diselesaikan oleh produk ini?",
      placeholder: "Contoh: Proses pencatatan data yang lambat dan rawan salah...",
      defaultValue: "",
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
      defaultValue: "Aplikasi Web (Responsive Browser)",
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
      defaultValue: "Next.js + Supabase (Web Modern)",
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
      defaultValue: ["Sistem Akun & Hak Akses", "Pencarian & Manajemen Data"],
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
      defaultValue: ["Payment Gateway (QRIS / VA Bank)", "Layanan Notifikasi Email / WhatsApp"],
    },
  ];
}

/**
 * Generate dokumen PRD berstandar industri 14 Bab + Roadmap Pengembangan Lengkap
 */
export async function generatePRDFromAI(params: {
  title: string;
  description: string;
  answers?: Record<string, string | string[]>;
  questions?: DynamicQuestion[];
  targetAudience?: string;
  techStack?: string;
  hosting?: string;
  thirdParty?: string;
  modelOverride?: string;
}): Promise<{ contentMarkdown: string; taskBreakdown: Array<{ task: string; done: boolean }> }> {
  const { client, config } = await create9routerClient();
  const modelToUse = params.modelOverride || config.defaultModel;

  const systemPrompt = `Anda adalah seorang Principal Product Manager dan Software Architect kelas dunia.
Tugas Anda adalah menyusun dokumen Product Requirements Document (PRD) yang SANGAT DETAIL, MENDALAM, TERPERINCI, PROFESIONAL, KAYA PENJELASAN TEKNIS, dan MENGIKUTI STRUKTUR LENGKAP 14 BAB (13 Bab PRD + Bab 14 Roadmap).

JANGAN PERNAH MENGGUNAKAN EMOJI SAMA SEKALI DALAM SELURUH DOKUMEN!
Gunakan Bahasa Indonesia profesional yang lugas, terstruktur, tidak hemat kata, dan menjelaskan konteks dengan tuntas.

ATURAN STRUKTUR DOKUMEN WAJIB (Ikuti format di bawah 100%):

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## [NAMA_PRODUK]

**STATUS: DRAFT SEMENTARA**

| | |
| --- | --- |
| **Nama Produk** | [NAMA_PRODUK_LENGKAP] |
| **Versi Dokumen** | v0.1 |
| **Disusun oleh** | Tim Product & Engineering |
| **Untuk** | Tim Pengembang & Stakeholder |
| **Tanggal** | [TANGGAL_HARI_INI] |
| **Dokumen Terkait** | Hasil Analisis Kebutuhan Awal & Tanya Jawab Teknis |

---

# 1. Ringkasan Produk (Overview)
[Tulis minimal 2-3 paragraf mendalam.
Paragraf 1: Latar belakang kondisi operasional saat ini, kendala proses manual, inefisiensi, risiko kegagalan, dan pain point utama yang dihadapi pengguna/organisasi.
Paragraf 2: Solusi sistematis yang akan dibangun. Jelaskan jenis arsitektur (Web, Mobile, REST API, Microservices), modul-modul inti, dan pendekatan sandboxing/keamanan jika relevan.
Paragraf 3: Dampak strategis jangka panjang bagi efisiensi bisnis dan kesiapan operasional tim.]

# 2. Tujuan & Sasaran (Goals)
[Tulis 4-6 poin bullet konkret mengenai outcome bisnis dan metrik kesuksesan terukur. Jangan hanya menulis nama fitur. Gunakan formula terukur, contoh:
- Mempercepat waktu eksekusi proses bisnis dari X menit menjadi di bawah Y detik.
- Mengurangi risiko human error dan potensi kebocoran data hingga 0% melalui validasi terisolasi.
- Menyediakan transparansi audit log dan monitoring real-time dengan availability 99.9%.
- Mengurangi beban kerja manual tim operasional hingga lebih dari 70%.]

# 3. Pengguna & Peran (Users & Roles)
[Tulis satu bullet per peran secara mendalam:
- **Nama Peran :** Rincian kewenangan, hak akses sistem, batasan privilege, dan aktivitas operasional utama yang dapat dilakukan.]

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP)
[Rincian kelompok fitur yang wajib selesai pada rilis perdana MVP:
- Modul Inti: Penjelasan cakupan fitur MVP.
- Mekanisme Otentikasi & Otorisasi.
- Alur Pemrosesan Data & Integrasi Utama.
- Sistem Logging & Penanganan Error Dasar.]

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan
[Rangkuman fitur yang sengaja ditunda ke tahap berikutnya untuk menjaga kecepatan rilis MVP. Rujuk detailnya ke Bab 11.]

# 5. Asumsi & Batasan (Assumptions & Constraints)
[Tulis 5-7 poin asumsi teknis dan batasan operasional. Setiap poin WAJIB diawali tag **[Asumsi]**, contoh:
- **[Asumsi]** Lingkungan deployment menggunakan server Linux dengan alokasi resource minimal yang ditentukan.
- **[Asumsi]** Koneksi jaringan pihak ketiga memiliki latency rata-rata di bawah ambang batas timeout.
- **[Asumsi]** Batas timeout eksekusi sistem dibatasi maksimal X detik untuk mencegah resource exhaustion.]

# 6. Kebutuhan Fungsional (Functional Requirements)
[Wajib dipecah menjadi minimal 4 sampai 6 sub-bab modul logis (misal: 6.1 AUTH — Autentikasi & Hak Akses, 6.2 CORE — Pemrosesan Utama & Engine, 6.3 DATA — Validasi & Manajemen Data, 6.4 NOTIF — Notifikasi & Integrasi, 6.5 SYS — Manajemen Sistem & Daemon).
Setiap sub-bab WAJIB berisi tabel Markdown lengkap dengan format:
| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **PREFIX-1** | Deskripsi kemampuan sistem/aktor secara detail dan jelas. | **Wajib** |
| **PREFIX-2** | Deskripsi kebutuhan sistem dengan parameter batas dan validasi. | **Penting** |
| **PREFIX-3** | Deskripsi kebutuhan lanjutan pendukung operasional. | **Fase 2** |

Catatan: Prefix adalah singkatan modul 3-4 huruf kapital (misal: AUTH, CORE, SYS, LOG, DASH). Prioritas hanya: **Wajib**, **Penting**, atau **Fase 2**.]

# 7. Alur Pengguna Utama (Key User Flows)
[Tulis minimal 3 sampai 4 sub-bab alur krusial:
## 7.1 [Nama Alur Utama - Happy Path]
[Tulis langkah 1 sampai 6+ secara kronologis dari perspektif user dan respons sistem. Sertakan perubahan status sistem dalam tanda kutip (misal: status pesan "Diproses", status autentikasi "Terverifikasi", status akhir "Selesai").]

## 7.2 [Nama Alur Pengecualian / Penanganan Masalah & Error Handling]
[Tulis langkah penanganan kegagalan, validasi gagal, timeout, atau penolakan akses.]

## 7.3 [Nama Alur Pemulihan / Revisi / Manajemen]
[Tulis langkah operasional pembaruan atau pembatalan.]]

# 8. Model Data (High-Level)
[Tabel skema entitas database relasional yang tersirat dari kebutuhan fungsional.
| **Entitas** | **Field Utama** | **Keterangan** |
| --- | --- | --- |
| nama_tabel | id (UUID), kolom_name (VARCHAR), status (ENUM), created_at (TIMESTAMP) | Penjelasan fungsi tabel dan relasi foreign key. |
Field wajib memakai snake_case. Field milik fase lanjutan ditulis dalam [kurung siku].]

# 9. Kebutuhan Non-Fungsional (Non-Functional Requirements)
[Tulis poin-poin mendalam dengan pola "**Aspek :** Penjelasan teknis":
- **Responsivitas :** Standar aksesibilitas dan dukungan perangkat.
- **Keamanan & Hak Akses :** Mekanisme isolasi, enkripsi data in-transit dan at-rest, proteksi token.
- **Skalabilitas :** Kapasitas penanganan beban concurrent request per detik.
- **Performa :** Target latency respons API di bawah batas milidetik tertentu.
- **Privasi Data :** Kepatuhan retensi data dan perlindungan informasi rahasia.]

# 10. Integrasi Pihak Ketiga
[Tabel Markdown:
| **Layanan** | **Fungsi** | **Catatan** |
Tuliskan library/service eksternal, API gateway, database provider, dll.]

# 11. Fitur Usulan / Fase Lanjutan
[Format per fitur:
- **Nama Fitur.** Penjelasan manfaat bisnis, spesifikasi teknis ringkas, dan keterkaitannya dengan modul MVP.]

# 12. Pertanyaan Terbuka / TBD
[Daftar hal-hal spesifikasi atau kebijakan yang belum diputuskan secara final untuk mencegah asumsi liar.]

# 13. Glosarium
[Format:
- **Istilah :** Definisi teknis dan domain bisnis dalam konteks sistem ini.]

# 14. Roadmap Pengembangan & Sprint Breakdown

## Fase 1: MVP Core (Sprint 1 - 2)
- **Target:** Fondasi arsitektur database, otentikasi aman, dan pemrosesan alur kerja inti.
- [ ] Task 1.1: Perancangan Skema Database, Relasi Entitas & Migration Script
- [ ] Task 1.2: Implementasi Middleware Otorisasi, Enkripsi & Proteksi Akses
- [ ] Task 1.3: Pembuatan Antarmuka Utama, Parser Payload & Form Input
- [ ] Task 1.4: Integrasi Runner Terisolasi & Validasi Input

## Fase 2: Integrasi & Beta Release (Sprint 3 - 4)
- **Target:** Integrasi pihak ketiga, sistem monitoring, logging terpusat, dan pengujian menyeluruh.
- [ ] Task 2.1: Integrasi API Layanan Eksternal, Webhook Handler & Notifikasi
- [ ] Task 2.2: Implementasi Logging Terstruktur, Status Dashboard & Health Check
- [ ] Task 2.3: User Acceptance Testing (UAT), Penanganan Edge Cases & Bug Fixing

## Fase 3: Post-MVP & Scaling (Fase Lanjutan)
- **Target:** Peningkatan performa, otomatisasi lanjutan, dan fitur skala enterprise.
- [ ] Task 3.1: Optimalisasi Caching, Connection Pooling & Load Stress Testing
- [ ] Task 3.2: Fitur Kolaborasi Multi-Role & Sistem Pelaporan Lanjutan

---
*Dokumen ini merupakan draft sementara dan dapat disesuaikan seiring pembahasan berkala.*`;

  let detailedAnswersSection = "";
  if (params.answers && Object.keys(params.answers).length > 0) {
    detailedAnswersSection = Object.entries(params.answers)
      .map(([k, v]) => {
        const valStr = Array.isArray(v) ? v.join(", ") : String(v || "-");
        return `- **${k}:** ${valStr}`;
      })
      .join("\n");
  } else {
    detailedAnswersSection = `
- **Target Pengguna:** ${params.targetAudience || "Sesuai kebutuhan produk"}
- **Tech Stack:** ${params.techStack || "Modern web/mobile stack yang direkomendasikan"}
- **Hosting/Server:** ${params.hosting || "Cloud hosting modern"}
- **Integrasi Eksternal:** ${params.thirdParty || "Sesuai kebutuhan fitur"}`;
  }

  const currentDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const userPrompt = `Nama Produk: ${params.title}
Deskripsi Ide & Kebutuhan: ${params.description}
Tanggal Dokumen: ${currentDate}

Detail Hasil Tanya Jawab Pengguna:
${detailedAnswersSection}

Susun dokumen PRD LENGKAP dengan seluruh 14 Bab di atas secara mendalam, terperinci, dan profesional. JANGAN gunakan emoji apa pun.`;

  try {
    const response = await client.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    const contentMarkdown = response.choices[0]?.message?.content || "";

    // Parse task list dari markdown
    const taskBreakdown: Array<{ task: string; done: boolean }> = [];
    const taskRegex = /- \[( |x)\] (.*)/gi;
    let match;
    while ((match = taskRegex.exec(contentMarkdown)) !== null) {
      taskBreakdown.push({
        task: match[2].trim(),
        done: match[1].toLowerCase() === "x",
      });
    }

    if (taskBreakdown.length === 0) {
      taskBreakdown.push(
        { task: "Desain skema database & model data", done: false },
        { task: "Implementasi antarmuka utama & API route", done: false },
        { task: "Integrasi layanan pihak ketiga", done: false },
        { task: "Pengujian & deployment", done: false }
      );
    }

    return { contentMarkdown, taskBreakdown };
  } catch (error: any) {
    console.error("Error generating PRD with 9router:", error);
    throw new Error(`Gagal generate PRD dari AI (${error.message || "Unknown error"})`);
  }
}

/**
 * Revisi PRD yang sudah ada berdasarkan instruksi user.
 * AI membaca seluruh dokumen PRD termasuk Bab 7 (User Flows) dan Bab 14 (Roadmap).
 */
export async function revisePRDWithAI(params: {
  currentContent: string;
  revisionInstruction: string;
  modelOverride?: string;
}): Promise<{ revisedMarkdown: string }> {
  const { client, config } = await create9routerClient();
  const modelToUse = params.modelOverride || config.defaultModel;

  const systemPrompt = `Anda adalah Principal Product Manager dan Software Architect.
Tugas Anda adalah memperbarui dokumen PRD yang ada berdasarkan instruksi revisi dari pengguna.
Anda memiliki akses ke seluruh dokumen termasuk Ringkasan, Kebutuhan Fungsional (Bab 6), Alur Pengguna (Bab 7), Model Data (Bab 8), dan Roadmap Pengembangan (Bab 14).

JANGAN PERNAH MENGGUNAKAN EMOJI SAMA SEKALI!

ATURAN REVISI:
1. Pahami instruksi revisi secara menyeluruh.
2. Jika instruksi berkaitan dengan alur (misal: "tambah alur refund" atau "ubah alur eksekusi"), perbarui Bab 7 dan Bab 6.
3. Jika instruksi berkaitan dengan timeline/roadmap (misal: "prioritaskan payment di sprint 1" atau "tambahkan fase audit keamanan"), perbarui Bab 14 (Roadmap) dan kebutuhan terkait.
4. Pertahankan seluruh 14 Bab dengan struktur format Markdown yang rapi, padat, dan konsisten.
5. Keluarkan SELURUH dokumen PRD yang sudah direvisi secara lengkap.`;

  const userPrompt = `Dokumen PRD saat ini:
--- START PRD ---
${params.currentContent}
--- END PRD ---

Instruksi Revisi dari Pengguna:
"${params.revisionInstruction}"

Keluarkan dokumen PRD lengkap yang telah disesuaikan dengan instruksi revisi tersebut tanpa emoji.`;

  try {
    const response = await client.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    const revisedMarkdown = response.choices[0]?.message?.content || params.currentContent;
    return { revisedMarkdown };
  } catch (error: any) {
    console.error("Error revising PRD with 9router:", error);
    throw new Error(`Gagal merevisi PRD (${error.message || "Unknown error"})`);
  }
}

/**
 * Helper Parser: Mengekstrak User Flows dari Bab 7 PRD Markdown
 */
export function parseUserFlowsFromMarkdown(markdown: string): ParsedUserFlow[] {
  const flows: ParsedUserFlow[] = [];
  
  const bab7Match = markdown.match(/# 7\.\s*Alur Pengguna Utama([\s\S]*?)(?=# 8\.|\n# [0-9]+\.|$)/i);
  if (!bab7Match) {
    return [
      {
        title: "Alur Utama Produk (Happy Path)",
        steps: [
          'Pengguna membuka aplikasi dan masuk ke akun dengan status "Aktif"',
          'Pengguna memilih item atau memasukkan data kebutuhan produk',
          'Sistem memvalidasi input dan menampilkan status "Diproses"',
          'Pengguna menyelesaikan konfirmasi dan sistem menghasilkan status "Selesai"',
        ],
      },
      {
        title: "Alur Pengecualian / Penanganan Masalah",
        steps: [
          'Pengguna mengajukan permintaan perubahan atau pembatalan',
          'Sistem memverifikasi syarat dan mengubah status menjadi "Menunggu Peninjauan"',
          'Sistem mengirimkan notifikasi status pembaruan kepada pengguna',
        ],
      },
    ];
  }

  const bab7Content = bab7Match[1];
  const subFlowRegex = /##\s*7\.\d+\s*([^\n]+)([\s\S]*?)(?=##\s*7\.\d+|$)/gi;
  let subMatch;

  while ((subMatch = subFlowRegex.exec(bab7Content)) !== null) {
    const title = subMatch[1].trim();
    const body = subMatch[2];
    const steps: string[] = [];

    const stepLineRegex = /^\s*\d+\.\s*(.+)$/gm;
    let stepMatch;
    while ((stepMatch = stepLineRegex.exec(body)) !== null) {
      steps.push(stepMatch[1].trim());
    }

    if (steps.length > 0) {
      flows.push({ title, steps });
    }
  }

  if (flows.length === 0) {
    flows.push({
      title: "Alur Utama Transaksi",
      steps: [
        'User melakukan input dan memilih opsi fitur',
        'Sistem memproses data dan menghasilkan status "Draf"',
        'User melakukan verifikasi dan status berubah menjadi "Final"',
      ],
    });
  }

  return flows;
}

/**
 * Helper Parser: Mengekstrak Roadmap Pengembangan dari Bab 14 PRD Markdown
 */
export function parseRoadmapFromMarkdown(markdown: string): ParsedRoadmapPhase[] {
  const phases: ParsedRoadmapPhase[] = [];

  const bab14Match = markdown.match(/# 14\.\s*Roadmap Pengembangan([\s\S]*?)(?=\n# [0-9]+\.|$)/i);
  if (!bab14Match) {
    return [
      {
        phaseTitle: "Fase 1: MVP Core Foundation",
        timeline: "Sprint 1 - 2 (Bulan 1)",
        milestones: ["Fondasi Database", "Autentikasi User", "Alur Kerja Utama MVP"],
        tasks: [
          { task: "Desain skema database & model data", done: true },
          { task: "Implementasi antarmuka utama & API routes", done: true },
          { task: "Setup proteksi autentikasi & middleware", done: false },
        ],
      },
      {
        phaseTitle: "Fase 2: Integrasi & Beta Release",
        timeline: "Sprint 3 - 4 (Bulan 2)",
        milestones: ["Integrasi Layanan Pihak Ketiga", "Dashboard Monitoring", "Beta Testing UAT"],
        tasks: [
          { task: "Integrasi API eksternal & webhook", done: false },
          { task: "User Acceptance Testing (UAT)", done: false },
        ],
      },
      {
        phaseTitle: "Fase 3: Post-MVP & Scaling",
        timeline: "Fase Lanjutan (Bulan 3+)",
        milestones: ["Fitur Kolaborasi Tim", "Optimasi Performa", "Scale Out"],
        tasks: [
          { task: "Fitur multi-user & role permissions", done: false },
          { task: "Optimasi caching & load testing", done: false },
        ],
      },
    ];
  }

  const bab14Content = bab14Match[1];
  const phaseRegex = /##\s*([^\n]+)([\s\S]*?)(?=##\s*|$)/gi;
  let phaseMatch;

  while ((phaseMatch = phaseRegex.exec(bab14Content)) !== null) {
    const rawTitle = phaseMatch[1].trim();
    const body = phaseMatch[2];

    let timeline = "Sprint Terjadwal";
    const targetMatch = body.match(/- \*\*Target:\*\*\s*([^\n]+)/i);
    const milestones = targetMatch ? targetMatch[1].split(/,|dan/i).map((s) => s.trim()) : [];

    const tasks: Array<{ task: string; done: boolean }> = [];
    const taskRegex = /- \[( |x)\] (.*)/gi;
    let tMatch;
    while ((tMatch = taskRegex.exec(body)) !== null) {
      tasks.push({
        task: tMatch[2].trim(),
        done: tMatch[1].toLowerCase() === "x",
      });
    }

    phases.push({
      phaseTitle: rawTitle,
      timeline: timeline,
      milestones: milestones.length > 0 ? milestones : ["Milestone Fitur Utama"],
      tasks: tasks.length > 0 ? tasks : [{ task: "Pengerjaan deliverables fase", done: false }],
    });
  }

  return phases;
}

/**
 * Menguji koneksi live ke 9router AI Gateway
 */
export async function test9routerConnection(customConfig?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ success: boolean; latencyMs: number; responseMessage: string }> {
  const startTime = Date.now();
  const { client, config } = await create9routerClient(customConfig);
  const modelToTest = customConfig?.model || config.defaultModel || "gemini-1.5-flash";

  try {
    const res = await client.chat.completions.create({
      model: modelToTest,
      messages: [{ role: "user", content: "Ping. Balas singkat dengan kata: OK" }],
      max_tokens: 10,
    });

    const latencyMs = Date.now() - startTime;
    const text = res.choices[0]?.message?.content?.trim() || "OK";

    return {
      success: true,
      latencyMs,
      responseMessage: `Koneksi berhasil ke ${config.provider || "9router"} (${modelToTest}). Balasan: "${text}"`,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      responseMessage: `Koneksi gagal: ${error.message || "Gagal menghubungi endpoint 9router"}`,
    };
  }
}
