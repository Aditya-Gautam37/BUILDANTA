import { ensureBucketExists } from "@buildanta/api";
import { prisma } from "@buildanta/db";

import { buildApp } from "./app.js";
import { serverEnv } from "./env.js";

/**
 * The single API process. Hosts the tRPC router and the image upload route.
 * Uploaded files themselves are served directly from Supabase Storage's own
 * CDN, never by this process.
 *
 * Everything that configures the app itself (plugins, hooks, routes) lives in
 * app.ts; this file only does the parts specific to actually running as a
 * process — binding a port, creating the storage bucket, and shutting down
 * cleanly — so a test can build the exact same app without any of that.
 */
async function main(): Promise<void> {
  const server = serverEnv();
  const app = await buildApp();

  // Idempotent — safe on every start, including a second instance racing this
  // one in a multi-process deployment. Awaited before `listen` so the very
  // first upload request is never racing bucket creation.
  await ensureBucketExists();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    // Fastify first, so in-flight requests finish before the pool they depend on is
    // torn out from under them.
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  await app.listen({ port: server.port, host: server.host });
  app.log.info(`Buildanta API on http://${server.host}:${server.port}`);
}

main().catch((error: unknown) => {
  console.error("\nAPI failed to start:\n");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
