import { createAdminClient } from "@/lib/supabase/admin";

export interface PakasirConfig {
  slug: string;
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
}

export interface PakasirQRISResponse {
  txn_id: string;
  project: string;
  order_id: string;
  amount: number;
  fee: number;
  total_payment: number;
  payment_method: string;
  qr_string: string;
  va_number?: string;
  expired_at: string;
  is_sandbox: boolean;
  status: "pending" | "completed" | "canceled";
  completed_at: string | null;
}

export interface PakasirStatusResponse {
  txn_id: string;
  order_id: string;
  amount: number;
  is_sandbox: boolean;
  status: "pending" | "completed" | "canceled";
  completed_at: string | null;
}

/**
 * Mengambil konfigurasi Pakasir dinamis dari database (system_settings),
 * dengan fallback ke environment variables di server.
 */
export async function getDynamicPakasirConfig(): Promise<PakasirConfig> {
  let slug = process.env.PAKASIR_SLUG || "prdgen";
  let apiKey = process.env.PAKASIR_API_KEY || "";
  let webhookSecret = process.env.PAKASIR_WEBHOOK_SECRET || "";
  let baseUrl = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";

  try {
    const supabase = createAdminClient();
    const { data: settingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pakasir_config")
      .single();

    if (settingData?.value) {
      const val = settingData.value as any;
      if (val.slug) slug = val.slug;
      if (val.api_key) apiKey = val.api_key;
      if (val.webhook_secret) webhookSecret = val.webhook_secret;
      if (val.base_url) baseUrl = val.base_url;
    }
  } catch (err) {
    console.warn("Menggunakan fallback Pakasir config dari environment variables:", err);
  }

  return { slug, apiKey, webhookSecret, baseUrl };
}

/**
 * Membuat transaksi QRIS baru via Pakasir API v2
 */
export async function createPakasirQRIS(params: {
  orderId: string;
  amount: number;
}): Promise<PakasirQRISResponse> {
  const config = await getDynamicPakasirConfig();

  if (!config.apiKey || !config.slug) {
    throw new Error(
      "Kredensial Pakasir belum dikonfigurasi. Isi Slug & API Key di Admin > Pengaturan."
    );
  }

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v2/create-transaction/${encodeURIComponent(
    config.slug
  )}/${encodeURIComponent(params.orderId)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify({
      method: "qris",
      amount: params.amount,
    }),
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    const detail = data?.message || data?.error || responseText || "tanpa keterangan";
    console.error(`Pakasir create-transaction gagal (HTTP ${response.status}):`, detail);
    throw new Error(
      `Pakasir menolak pembuatan transaksi (HTTP ${response.status}): ${detail}`
    );
  }

  return data as PakasirQRISResponse;
}

/**
 * Memeriksa status transaksi ke Pakasir API v2
 */
export async function checkPakasirStatus(txnId: string): Promise<PakasirStatusResponse> {
  const config = await getDynamicPakasirConfig();

  if (!config.apiKey || !config.slug) {
    throw new Error(
      "Kredensial Pakasir belum dikonfigurasi. Isi Slug & API Key di Admin > Pengaturan."
    );
  }

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v2/transaction-status/${encodeURIComponent(
    config.slug
  )}/${encodeURIComponent(txnId)}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Api-Key": config.apiKey,
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    const detail = data?.message || data?.error || responseText || "tanpa keterangan";

    if (response.status === 429) {
      throw new Error(
        "Pakasir membatasi pengecekan status (maks 1 request per 4 detik). Sistem akan mencoba lagi otomatis."
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Pakasir menolak akses (HTTP ${response.status}). Periksa Slug & API Key di Admin > Pengaturan.`
      );
    }
    if (response.status === 404) {
      throw new Error(
        "Transaksi tidak ditemukan di Pakasir. Pastikan TXN ID dan Slug berasal dari project yang sama."
      );
    }

    console.error(`Pakasir transaction-status gagal (HTTP ${response.status}):`, detail);
    throw new Error(`Gagal cek status di Pakasir (HTTP ${response.status}): ${detail}`);
  }

  return data as PakasirStatusResponse;
}

/**
 * Mengambil payload mentah transaksi dari Pakasir (untuk investigasi & diagnostics)
 */
export async function getPakasirTransaction(txnId: string): Promise<any> {
  const config = await getDynamicPakasirConfig();

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v2/transaction-status/${encodeURIComponent(
    config.slug
  )}/${encodeURIComponent(txnId)}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Api-Key": config.apiKey,
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  return { ok: response.ok, httpStatus: response.status, payload: data };
}
