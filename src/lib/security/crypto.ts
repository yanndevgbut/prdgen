import crypto from "node:crypto";

/**
 * Enkripsi & dekripsi rahasia (mis. password sementara saat registrasi OTP)
 * menggunakan AES-256-GCM. Kunci dibaca dari OTP_ENCRYPTION_KEY (32-byte hex).
 *
 * PENTING: Kunci harus di-set di environment variables (server-only).
 * Jika tidak ada, fungsi akan melempar error keras agar sistem TIDAK pernah
 * diam-diam menyimpan plaintext.
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const keyHex = process.env.OTP_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "OTP_ENCRYPTION_KEY belum disetel. Set env var ini (32-byte hex) sebelum registrasi."
    );
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("OTP_ENCRYPTION_KEY harus 32 byte (64 karakter hex).");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV untuk GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(hex) + ":" + authTag(hex) + ":" + ciphertext(hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Format ciphertext tidak valid.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
