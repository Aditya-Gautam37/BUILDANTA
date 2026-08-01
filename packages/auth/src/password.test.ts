import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  fakeVerifyPassword,
  hashPassword,
  verifyPassword,
} from "./password.js";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a valid password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(
      true,
    );
  });

  it("rejects the wrong password against a real hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password entirely")).resolves.toBe(
      false,
    );
  });

  it("never produces the same hash twice for the same password", async () => {
    // Argon2 salts each hash independently. Two identical hashes would mean the
    // salt was not random, which is the whole point of hashing over encrypting.
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
  });

  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH} characters`, async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it(`rejects a password longer than ${PASSWORD_MAX_LENGTH} characters`, async () => {
    await expect(hashPassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).rejects.toThrow();
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    // A corrupted or legacy row must read as "wrong password", not crash the login
    // endpoint into a 500 that confirms the account exists.
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });

  it("returns false rather than throwing for an over-length attempt", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword(hash, "a".repeat(PASSWORD_MAX_LENGTH + 1)),
    ).resolves.toBe(false);
  });
});

describe("fakeVerifyPassword", () => {
  it("resolves without throwing for any input", async () => {
    // This is the login route's defence against timing-based user enumeration: it
    // must always resolve normally, never reject, regardless of what is passed.
    await expect(fakeVerifyPassword("whatever")).resolves.toBeUndefined();
    await expect(fakeVerifyPassword("")).resolves.toBeUndefined();
  });
});
