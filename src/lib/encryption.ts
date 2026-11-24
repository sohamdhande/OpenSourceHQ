import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("APP_ENCRYPTION_KEY must be configured with at least 32 characters in production.");
  }
  const effectiveSecret = secret || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  return crypto.scryptSync(effectiveSecret, "opensourcehq-salt", 32);
}

/**
 * Encrypts a string (e.g. GitHub OAuth token) for at-rest storage in database
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV + tag + ciphertext into base64 string
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a ciphertext string encrypted with encryptToken
 */
export function decryptToken(ciphertextBase64: string): string {
  if (!ciphertextBase64) return "";
  try {
    const key = getKey();
    const buffer = Buffer.from(ciphertextBase64, "base64");

    if (buffer.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error("Invalid ciphertext length");
    }

    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Token decryption failed", error);
    return "";
  }
}

