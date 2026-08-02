import crypto from "node:crypto";

/**
 * Application-side encryption for exchange API credentials.
 *
 * RLS on `exchange_credentials` stops another user from reading the row;
 * this stops a database-level leak (a backup, a misconfigured export, a
 * compromised service-role key) from reading the plaintext, because the key
 * that decrypts it lives only in this process's environment, never in
 * Postgres. Never call this from client code — it is server-only by
 * construction (it imports `node:crypto`, which does not bundle for the
 * browser), but keep it that way.
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.AI_TRADER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "AI_TRADER_ENCRYPTION_KEY is not configured. Generate one with `openssl rand -hex 32`.",
    );
  }

  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "AI_TRADER_ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex characters).",
    );
  }
  return buf;
}

/** `iv:authTag:ciphertext`, each hex — self-contained, so decrypting needs nothing but the key. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Malformed encrypted payload.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
