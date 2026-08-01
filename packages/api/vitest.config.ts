import { defineConfig } from "vitest/config";

/**
 * The default config, run by `pnpm test` / `pnpm verify`. Deliberately excludes
 * `*.integration.test.ts` files, which need a real Postgres connection — see
 * vitest.integration.config.ts. `pnpm verify` has been fully database-independent
 * since it existed; this keeps it that way rather than silently making it require
 * a live database.
 */
export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.integration.test.ts",
    ],
  },
});
