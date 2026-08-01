import { randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/**
 * `Algorithm` is declared as an ambient `const enum`, which cannot be referenced
 * as a value under `verbatimModuleSyntax`. The numeric encodings are part of the
 * package's public API (Argon2d = 0, Argon2i = 1, Argon2id = 2), so the value is
 * pinned here rather than left to the library default — the choice of algorithm
 * is not something a dependency upgrade should be able to change silently.
 */
const ARGON2ID = 2 as Algorithm;

/**
 * Argon2id parameters, following the OWASP Password Storage Cheat Sheet baseline
 * (19 MiB memory, 2 iterations, 1 degree of parallelism). Centralised here so no
 * app hashes with its own settings.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Argon2 has no practical input limit, but an unbounded password is a cheap way
 * to burn CPU on the login endpoint. 200 characters is well past any real one.
 */
export const PASSWORD_MAX_LENGTH = 200;

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
  if (plaintext.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Returns false rather than throwing on a malformed or legacy hash, so a corrupt
 * row reads as "wrong password" instead of a 500 that confirms the account
 * exists.
 */
export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  if (plaintext.length > PASSWORD_MAX_LENGTH) return false;
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Hash of a random value nobody can supply, generated once on first use.
 *
 * It must be a genuine Argon2 encoding: a hand-written fake would be rejected
 * during parsing and return in ~0 ms, which is exactly the timing leak this
 * guards against.
 */
let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hash(randomBytes(32).toString("base64url"), ARGON2_OPTIONS);
  return dummyHash;
}

/**
 * Spends the same CPU time as a real check, for use when the email does not
 * exist. Without it, "no such user" returns in ~0 ms while a real user takes
 * ~50 ms, and the login endpoint becomes a user-enumeration oracle.
 */
export async function fakeVerifyPassword(plaintext: string): Promise<void> {
  await verifyPassword(await getDummyHash(), plaintext);
}
