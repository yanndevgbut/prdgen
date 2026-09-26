import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window cache
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup expired records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

/**
 * Ekstraksi IP klien secara aman dari request header
 */
export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers;
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip") || headers.get("cf-connecting-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Memeriksa pembatasan frekuensi aksi (Rate Limiting)
 * @param identifier IP atau User ID
 * @param action Nama namespace aksi (misal: 'register', 'ai_generate', 'ai_questions')
 * @param limit Batas maksimal request dalam jendela waktu
 * @param windowSeconds Jendela waktu dalam detik
 */
export function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    // Buat jendela waktu baru
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (existing.count >= limit) {
    const remainingSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds: remainingSeconds > 0 ? remainingSeconds : 1,
    };
  }

  existing.count += 1;
  const remainingSeconds = Math.ceil((existing.resetAt - now) / 1000);

  return {
    allowed: true,
    limit,
    remaining: limit - existing.count,
    resetSeconds: remainingSeconds > 0 ? remainingSeconds : 1,
  };
}
