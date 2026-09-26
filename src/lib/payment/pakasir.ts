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
    throw new Error("Kredensial Pakasir (SLUG atau API Key) belum dikonfigurasi.");
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

  const data = await response.json();

  if (!response.ok) {
    console.error("Pakasir API error response:", data);
    throw new Error(data.message || data.error || "Gagal membuat transaksi QRIS di Pakasir.");
  }

  return data as PakasirQRISResponse;
}

/**
 * Memeriksa status transaksi ke Pakasir API v2
 */
export async function checkPakasirStatus(txnId: string): Promise<PakasirStatusResponse> {
  const config = await getDynamicPakasirConfig();

  if (!config.apiKey || !config.slug) {
    throw new Error("Kredensial Pakasir belum dikonfigurasi.");
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

  const data = await response.json();

  if (!response.ok) {
    console.error("Pakasir status API error:", data);
    throw new Error(data.message || "Gagal memeriksa status transaksi di Pakasir.");
  }

  return data as PakasirStatusResponse;
}
