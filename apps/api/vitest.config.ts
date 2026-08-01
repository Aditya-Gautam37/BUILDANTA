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

    /**
     * Raised from vitest's 5s default because these tests genuinely need it,
     * not to paper over a hang.
     *
     * Every test here calls `vi.resetModules()` and re-imports the module under
     * test, so each one pays a fresh construction of the Fastify instance and
     * the Prisma client rather than sharing one. Measured on a developer
     * machine: 11 tests take 12–15s in total, and the first test in
     * context.test.ts — which asserts a pure synchronous function — took
     * 5035ms against the 5000ms default and failed, purely on cold-import cost,
     * while four other workspaces' suites ran in parallel.
     *
     * A CI runner has fewer cores than the machine that measured that, so the
     * default would turn a correct suite into an intermittently red one. The
     * ceiling is high enough that a real hang still fails the run rather than
     * hanging the job.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
