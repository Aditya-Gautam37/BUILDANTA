import { describe, expect, it } from "vitest";

import {
  SESSION_TTL_MS,
  createSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "./session.js";

describe("createSessionToken", () => {
  it("produces a different token on every call", () => {
    // Two equal tokens would mean two visitors could share a session by chance —
    // the whole security property rests on this being effectively impossible.
    const seen = new Set(Array.from({ length: 50 }, () => createSessionToken()));
    expect(seen.size).toBe(50);
  });

  it("is URL-safe, since it travels in a cookie", () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashSessionToken", () => {
  it("is deterministic, so a stored hash can be matched on lookup", () => {
    const token = createSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("differs for different tokens", () => {
    expect(hashSessionToken(createSessionToken())).not.toBe(
      hashSessionToken(createSessionToken()),
    );
  });

  it("never returns the input token itself", () => {
    // The point of hashing before storage is that a database leak must not hand
    // back a replayable session token.
    const token = createSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });
});

describe("sessionExpiry", () => {
  it("is exactly SESSION_TTL_MS after the given time", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(sessionExpiry(from).getTime()).toBe(from.getTime() + SESSION_TTL_MS);
  });

  it("defaults to now when no base time is given", () => {
    const before = Date.now();
    const expiry = sessionExpiry();
    const after = Date.now();
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + SESSION_TTL_MS);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + SESSION_TTL_MS);
  });
});
