import { NextRequest } from "next/server";

/**
 * Rate Limiting dengan dukungan Redis (Upstash) dan fallback in-memory.
 *
 * Di production, gunakan Redis via UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN.
 * Di development/lokal, fallback ke in-memory Map.
 */

// --- Redis Client (lazy init) ---
let redisClient: any = null;

async function getRedisClient() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // Fallback ke in-memory
  }

  try {
    // Dynamic import agar tidak error di development tanpa Redis
    // Gunakan require agar tidak perlu type declaration
    const { Redis } = require("@upstash/redis");
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    console.warn("Gagal inisialisasi Redis, fallback ke in-memory:", err);
    return null;
  }
}

// --- In-Memory Fallback ---
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

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
export async function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  const key = `ratelimit:${action}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Gunakan Redis jika tersedia (production)
  if (redis) {
    try {
      const result = await redis.incr(key);
      if (result === 1) {
        // Set TTL untuk window pertama kali
        await redis.pexpire(key, windowMs);
      }

      if (result > limit) {
        // Ambil TTL untuk hitung sisa waktu
        const ttl = await redis.pttl(key);
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetSeconds: Math.ceil(ttl / 1000) > 0 ? Math.ceil(ttl / 1000) : 1,
        };
      }

      return {
        allowed: true,
        limit,
        remaining: limit - result,
        resetSeconds: windowSeconds,
      };
    } catch (err) {
      console.warn("Redis rate limit error, fallback ke in-memory:", err);
      // Fallback ke in-memory di bawah
    }
  }

  // In-Memory Fallback
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