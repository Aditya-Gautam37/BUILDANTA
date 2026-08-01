import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAll, consume, reset } from "./rate-limit.js";

describe("consume", () => {
  beforeEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(consume("key", 5, 1000).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 5; i += 1) consume("key", 5, 1000);
    const sixth = consume("key", 5, 1000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    // The login limiter keys on IP and on email separately; one must not exhaust
    // the other's budget.
    for (let i = 0; i < 5; i += 1) consume("login:ip:1.2.3.4", 5, 1000);
    expect(consume("login:email:a@example.com", 5, 1000).allowed).toBe(true);
  });

  it("resets the window after it expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    for (let i = 0; i < 5; i += 1) consume("key", 5, 1000);
    expect(consume("key", 5, 1000).allowed).toBe(false);

    vi.setSystemTime(1001);
    expect(consume("key", 5, 1000).allowed).toBe(true);

    vi.useRealTimers();
  });
});

describe("reset", () => {
  beforeEach(() => clearAll());

  it("clears the counter for a key, e.g. after a successful login", () => {
    for (let i = 0; i < 5; i += 1) consume("key", 5, 1000);
    expect(consume("key", 5, 1000).allowed).toBe(false);

    reset("key");
    expect(consume("key", 5, 1000).allowed).toBe(true);
  });
});
