import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `cookieOptions()` (exported from context.ts specifically so this doesn't
 * need a full request/response round trip) is what decides whether the admin
 * session cookie can be stolen by an XSS, replayed cross-site, or sent over
 * plain HTTP in production. Each flag is asserted individually rather than
 * snapshotted as one object, so a future change that flips exactly one of
 * them fails with a message that says which one, not just "objects differ."
 */

const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  SESSION_SECRET: "a".repeat(32),
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

let savedNodeEnv: string | undefined;

beforeEach(() => {
  savedNodeEnv = process.env.NODE_ENV;
  Object.assign(process.env, REQUIRED_ENV);
});

afterEach(() => {
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
  vi.resetModules();
});

async function loadCookieOptions() {
  vi.resetModules();
  const mod = await import("./context.js");
  return mod.cookieOptions;
}

describe("cookieOptions()", () => {
  it("is httpOnly, path=/, sameSite=lax, and signed, regardless of environment", async () => {
    process.env.NODE_ENV = "development";
    const cookieOptions = await loadCookieOptions();
    const options = cookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
    expect(options.signed).toBe(true);
  });

  it("is not marked secure in development (plain HTTP)", async () => {
    process.env.NODE_ENV = "development";
    const cookieOptions = await loadCookieOptions();
    expect(cookieOptions().secure).toBe(false);
  });

  it("is marked secure in production (HTTPS only)", async () => {
    process.env.NODE_ENV = "production";
    const cookieOptions = await loadCookieOptions();
    expect(cookieOptions().secure).toBe(true);
  });

  it("includes an expires date when given one", async () => {
    const cookieOptions = await loadCookieOptions();
    const expires = new Date("2030-01-01T00:00:00.000Z");
    expect(cookieOptions(expires).expires).toBe(expires);
  });

  it("omits expires entirely when none is given (a session/clear cookie)", async () => {
    const cookieOptions = await loadCookieOptions();
    expect("expires" in cookieOptions()).toBe(false);
  });
});
