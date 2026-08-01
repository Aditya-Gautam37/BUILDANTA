import { defineConfig } from "vitest/config";

/**
 * These tests build the real Fastify app (app.ts) and exercise it in-process
 * via `app.inject()` — no open socket, no real Postgres or Supabase Storage
 * call, since every route under test here resolves before touching either.
 * They stay in the default `test` / `pnpm verify` path, unlike
 * `test:integration`, precisely because they don't need either.
 */
export default defineConfig({
  test: {
    environment: "node",
  },
});
