import { defineConfig } from "vitest/config";

/**
 * Run explicitly with `pnpm test:integration`, never as part of `pnpm test` or
 * `pnpm verify`. These tests need `DATABASE_URL` to point at a real, reachable
 * Postgres — see docs/testing.md for why that boundary is deliberate.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    // Integration tests share real database state; running them one at a time
    // avoids two files racing on the same fixture data.
    fileParallelism: false,
  },
});
