import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `env()` caches on first call (packages/api/src/env.ts) — correct in a real
 * process, where the environment never changes mid-run, but exactly wrong for
 * testing several different configurations in one file. `vi.resetModules()`
 * plus a dynamic re-import gets a genuinely fresh module (and therefore a
 * fresh cache) per test, without adding a test-only reset export to
 * production code just to make this possible.
 */

const REQUIRED = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  SESSION_SECRET: "a".repeat(32),
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
} as const;

const ENV_KEYS = [
  ...Object.keys(REQUIRED),
  "NODE_ENV",
  "SESSION_COOKIE_NAME",
  "SUPABASE_STORAGE_BUCKET",
  "DEFAULT_CURRENCY",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.resetModules();
});

async function loadEnv() {
  vi.resetModules();
  return import("./env.js");
}

describe("env()", () => {
  it("parses successfully when every required variable is valid", async () => {
    Object.assign(process.env, REQUIRED);
    // Explicitly cleared rather than assumed absent: vitest's own runner sets
    // NODE_ENV=test ambiently, so leaving it alone would test that value, not
    // the schema's actual default-when-unset behaviour.
    delete process.env.NODE_ENV;
    const { env } = await loadEnv();
    expect(env().DATABASE_URL).toBe(REQUIRED.DATABASE_URL);
    // Defaults apply when not overridden.
    expect(env().DEFAULT_CURRENCY).toBe("INR");
    expect(env().SUPABASE_STORAGE_BUCKET).toBe("product-images");
    expect(env().NODE_ENV).toBe("development");
  });

  it("crashes with a readable message when DATABASE_URL is missing", async () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.DATABASE_URL;
    const { env } = await loadEnv();
    expect(() => env()).toThrowError(/DATABASE_URL/);
  });

  it("crashes when SESSION_SECRET is present but too short", async () => {
    Object.assign(process.env, REQUIRED, { SESSION_SECRET: "too-short" });
    const { env } = await loadEnv();
    expect(() => env()).toThrowError(/SESSION_SECRET/);
  });

  it("crashes when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { env } = await loadEnv();
    expect(() => env()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("crashes when DEFAULT_CURRENCY is not a 3-letter ISO code", async () => {
    Object.assign(process.env, REQUIRED, { DEFAULT_CURRENCY: "rupees" });
    const { env } = await loadEnv();
    expect(() => env()).toThrowError(/DEFAULT_CURRENCY/);
  });

  it("caches the parsed result — a second call does not re-validate", async () => {
    Object.assign(process.env, REQUIRED);
    const { env } = await loadEnv();
    const first = env();
    // Mutating process.env after the first call must not matter: real code
    // reads configuration once at startup, not on every request.
    process.env.DEFAULT_CURRENCY = "usd"; // now invalid, if it were re-parsed
    const second = env();
    expect(second).toBe(first);
    expect(second.DEFAULT_CURRENCY).toBe("INR");
  });

  it("isProduction() reflects NODE_ENV", async () => {
    Object.assign(process.env, REQUIRED, { NODE_ENV: "production" });
    const { isProduction } = await loadEnv();
    expect(isProduction()).toBe(true);
  });
});
