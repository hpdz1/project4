import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Secrets for accounts: inbound aliases (write-only capability: they let
 * someone send mail into an account) and sign-in keys (read capability,
 * stored only as a SHA-256 hash).
 */

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/** RFC 4648 base32, lowercase, without padding. */
export function base32(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** A new inbound alias: "r-" plus 16 base32 characters (80 random bits), e.g. "r-k3j9x2m4q8w1abcd". */
export function generateAlias(): string {
  return `r-${base32(randomBytes(10))}`;
}

/** A new secret sign-in key: 32 random bytes (256 bits) as base64url, 43 characters. */
export function generateAccountKey(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of a sign-in key, lowercase hex. A fast hash is fine for 256-bit random keys. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Constant-time string comparison for secrets. Both sides are hashed first,
 * so neither the contents nor the length of `expected` leak through timing.
 */
export function safeEqual(actual: string, expected: string): boolean {
  const a = createHash("sha256").update(actual, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && actual.length === expected.length;
}
