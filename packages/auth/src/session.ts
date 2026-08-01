import { createHash, randomBytes } from "node:crypto";

/** Admin sessions last 7 days. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A session inside this window of its expiry is extended on use, so an admin
 * working daily is never logged out mid-edit, while an abandoned session still
 * dies on schedule.
 */
export const SESSION_RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * The value that goes in the cookie: 32 bytes of CSPRNG output. It is never
 * stored — only its hash is.
 */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 is correct here and Argon2 would be wrong: the token is already
 * high-entropy random, so there is nothing to brute-force, and session lookup
 * happens on every request where a 50 ms KDF would be unaffordable.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MS);
}
