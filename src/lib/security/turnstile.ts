const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Token dummy resmi dari Cloudflare untuk keperluan testing. */
const DUMMY_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export interface TurnstileResult {
  success: boolean;
  reason?: string;
}

/**
 * Memverifikasi token Cloudflare Turnstile di sisi server.
 *
 * WAJIB dipanggil dari server (route handler / server action), bukan dari
 * browser, karena Secret Key tidak boleh pernah terekspos ke client.
 *
 * Catatan test mode: di luar production, token dummy Cloudflare dianggap valid
 * sehingga developer bisa menguji alur tanpa key asli. Di production tidak ada
 * jalur bypass sama sekali.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<TurnstileResult> {
  if (!token || typeof token !== "string") {
    return { success: false, reason: "Verifikasi keamanan belum dilakukan." };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // --- Mode pengembangan / test ---
  if (!isProduction) {
    if (token === DUMMY_TEST_TOKEN) {
      return { success: true };
    }
    if (!secretKey) {
      // Belum punya key sama sekali: izinkan agar alur lokal tetap bisa dicoba.
      return { success: true };
    }
  }

  // --- Produksi: wajib ada secret key ---
  if (!secretKey) {
    return {
      success: false,
      reason: "Verifikasi keamanan belum dikonfigurasi di server.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || !data?.success) {
      const codes: string[] = Array.isArray(data?.["error-codes"])
        ? data["error-codes"]
        : [];
      return {
        success: false,
        reason: `Verifikasi keamanan gagal${codes.length ? ` (${codes.join(", ")})` : ""}.`,
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      reason: "Tidak dapat menghubungi layanan verifikasi keamanan.",
    };
  }
}
