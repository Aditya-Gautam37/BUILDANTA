import { defineConfig, devices } from "@playwright/test";

import { ADMIN_URL, API_URL, STOREFRONT_URL } from "./urls.js";

/**
 * End-to-end tests, driving all three real apps together against the real
 * (Supabase-backed) API — the layer the vitest integration test deliberately
 * does not cover, since that calls the router directly and never touches
 * Fastify, CORS, cookies, or an actual rendered page. Run with
 * `pnpm test:e2e`, never as part of `pnpm verify` — same reasoning as
 * `pnpm test:integration`: this needs a real, migrated database and three
 * running servers, and folding that into `pnpm verify` would silently change
 * what every other command in this repo can assume.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Specs share real database state; see individual fixtures.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  /**
   * Generous on purpose. A first-run measurement here hit two spurious
   * failures that turned out, on inspecting the saved screenshot, to show the
   * exact content the assertion was waiting for — fully rendered — just past
   * Playwright's 5s default `expect` timeout. The actual cause: the first
   * request to any given Next.js dev route in a run pays a cold-compile cost
   * this project has repeatedly measured at 15–25s (see git history around
   * the `maxParamLength` fix for the same symptom hit manually), on top of
   * every data fetch being a real round trip to a remote Supabase instance,
   * not a local database. Raising the ceiling is the honest fix; padding
   * individual assertions one at a time would just rediscover the same limit
   * on the next route no test has warmed up yet.
   *
   * A later run put numbers on it. A `router.replace` into `/products/[id]`
   * fetched its RSC payload successfully (200) and then sat waiting: a webpack
   * hot-update landed 5s later and the route's own page chunk only arrived
   * 13.7s after the RSC response, because that route was being compiled on
   * demand for the first time in that server's life. The client-side
   * transition — and so `page.url()` — cannot commit until that chunk loads,
   * which put a 15s assertion right on the edge of failing for reasons that
   * have nothing to do with the application.
   *
   * The durable answer is to run this suite against production builds
   * (`next build && next start`), where no route compiles on demand at all;
   * that is recorded as a recommendation in docs/testing.md rather than done
   * here, because it changes what the harness builds before it can run.
   */
  timeout: 180_000,
  expect: { timeout: 30_000 },

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Tests that need to already be signed in start from this saved
        // session, produced by the "setup" project's real UI login. Specs that
        // specifically test login itself (admin-login.spec.ts) explicitly
        // create their own fresh, unauthenticated context instead of using
        // this default.
        storageState: "./.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  /**
   * Starts all three apps if nothing is already listening on their ports, and
   * reuses whatever's already running otherwise — matching how this project
   * has been run manually throughout development. In CI, `reuseExistingServer`
   * is always false, so a stale process from a previous run can never be
   * mistaken for a fresh one.
   */
  webServer: [
    {
      command: "pnpm --filter @buildanta/api-server dev",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @buildanta/storefront dev",
      url: STOREFRONT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @buildanta/admin dev",
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
  ],
});
