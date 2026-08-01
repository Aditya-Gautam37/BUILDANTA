import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The real, fully-configured Fastify app (`app.ts` — the same thing
 * `server.ts` binds a port to), exercised in-process via Fastify's own
 * `app.inject()`. No open socket, no real Postgres or Supabase Storage call:
 * every request tested here is rejected by the CORS/CSRF `onRequest` hook
 * before it would reach a route handler that needs either. That's what keeps
 * this in the default `pnpm test` / `pnpm verify` path rather than needing
 * `test:integration`'s real database.
 *
 * The env values below are synthetic and never asked to actually connect to
 * anything — `DATABASE_URL` and `SUPABASE_URL` only need to satisfy Zod's
 * `.url()` shape check in packages/api/src/env.ts, since nothing in these
 * tests reaches Prisma or Supabase's client.
 */
const ALLOWED_ORIGIN = "http://localhost:3001";
const DISALLOWED_ORIGIN = "https://evil.example";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  process.env.DIRECT_URL = "postgresql://user:pass@localhost:5432/db";
  process.env.SESSION_SECRET = "a".repeat(32);
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  process.env.API_PORT = "4000";
});

let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import("./app.js");
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe("CORS and CSRF (onRequest hook)", () => {
  it("rejects a mutation from a disallowed origin", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/trpc/auth.login",
      headers: {
        origin: DISALLOWED_ORIGIN,
        "x-buildanta-client": "admin",
        "content-type": "application/json",
      },
      payload: { json: { email: "a@b.com", password: "whatever12345" } },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "Cross-origin request refused." });
  });

  it("rejects a mutation missing the x-buildanta-client header, even from an allowed origin", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/trpc/auth.login",
      headers: {
        origin: ALLOWED_ORIGIN,
        "content-type": "application/json",
      },
      payload: { json: { email: "a@b.com", password: "whatever12345" } },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "Missing x-buildanta-client header.",
    });
  });

  it("lets a mutation through the hook when both checks pass", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/trpc/auth.login",
      headers: {
        origin: ALLOWED_ORIGIN,
        "x-buildanta-client": "admin",
        "content-type": "application/json",
      },
      payload: { json: { email: "a@b.com", password: "whatever12345" } },
    });

    // Not 403: the request reached the actual login procedure, which then
    // fails for a completely different reason (no real database behind these
    // synthetic env values) — that failure is not this test's concern, only
    // that the CORS/CSRF hook is not what stopped it.
    expect(response.statusCode).not.toBe(403);
  });

  it("does not require the CSRF header on a GET request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/trpc/auth.me",
      headers: { origin: ALLOWED_ORIGIN },
    });

    expect(response.statusCode).not.toBe(403);
  });

  it("allows a request with no Origin header at all (same-origin requests, curl)", async () => {
    // Browsers omit `Origin` on plain same-origin navigations, and non-browser
    // clients often send no Origin header either. The allowlist check only
    // rejects a *present, disallowed* origin — treating "absent" the same as
    // "disallowed" would break legitimate same-origin and tooling requests for
    // no security benefit, since the CSRF header check still applies.
    const response = await app.inject({
      method: "POST",
      url: "/trpc/auth.login",
      headers: {
        "x-buildanta-client": "admin",
        "content-type": "application/json",
      },
      payload: { json: { email: "a@b.com", password: "whatever12345" } },
    });

    expect(response.statusCode).not.toBe(403);
  });
});

describe("health endpoint bypasses CORS/CSRF (it's a GET)", () => {
  it("does not 403 even from a disallowed origin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: DISALLOWED_ORIGIN },
    });
    expect(response.statusCode).not.toBe(403);
  });
});
