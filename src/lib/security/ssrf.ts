import { URL } from "node:url";

/**
 * Validasi URL publik untuk mencegah Server-Side Request Forgery (SSRF).
 * Memblokir loopback, metadata cloud (169.254.x.x), private IP (RFC 1918),
 * dan format non-HTTP(S).
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8 (Loopback)
  /^10\./, // 10.0.0.0/8 (Private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (Private)
  /^192\.168\./, // 192.168.0.0/16 (Private)
  /^169\.254\./, // 169.254.0.0/16 (Link-local / Cloud Metadata)
  /^0\./, // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT
  /^198\.18\./, // Benchmarking
  /^198\.51\.100\./, // TEST-NET-2
  /^203\.0\.113\./, // TEST-NET-3
  /^224\./, // Multicast
  /^240\./, // Reserved
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

export function validateSafePublicUrl(urlString: string): {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
} {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "URL tidak boleh kosong." };
  }

  const trimmed = urlString.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Format URL tidak valid." };
  }

  // Protokol harus HTTPS (atau HTTP di development)
  const isDev = process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && (!isDev || parsed.protocol !== "http:")) {
    return { valid: false, error: "Hanya protokol HTTPS yang diizinkan." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Cek blocked hostnames langsung
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: "Akses ke host internal ditolak." };
  }

  // Cek domain lokal / metadata
  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".arpa")
  ) {
    return { valid: false, error: "Akses ke domain internal/lokal ditolak." };
  }

  // Cek format IPv6 loopback / unique-local
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("[fc") ||
    hostname.startsWith("[fd") ||
    hostname.startsWith("[fe80:")
  ) {
    return { valid: false, error: "Akses ke alamat IPv6 privat ditolak." };
  }

  // Cek integer notation / octal representation (misal: 2130706433)
  if (/^\d+$/.test(hostname)) {
    return { valid: false, error: "Alamat host format numerik mentah ditolak." };
  }

  // Cek apakah hostname adalah IPv4
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: "Akses ke alamat IP privat/metadata ditolak." };
      }
    }
  }

  return { valid: true, sanitizedUrl: parsed.origin + parsed.pathname };
}
