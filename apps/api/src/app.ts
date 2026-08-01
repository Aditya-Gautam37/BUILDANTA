import { appRouter, env, isProduction } from "@buildanta/api";
import type { AppRouter } from "@buildanta/api";
import { prisma } from "@buildanta/db";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { createFastifyContext } from "./context.js";
import { serverEnv } from "./env.js";
import { registerUploadRoutes } from "./uploads.js";

/**
 * Builds and fully configures the Fastify app — every plugin, hook and route
 * — without binding a port. Separated from `server.ts`'s `main()` (which calls
 * this, then `ensureBucketExists()`, then `.listen()`) specifically so tests
 * can exercise the real CORS/CSRF/cookie configuration via Fastify's own
 * `app.inject()` in-process, with no open socket and no Supabase Storage call
 * — see app.test.ts.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const config = env();
  const server = serverEnv();

  const app = Fastify({
    // `false` under NODE_ENV=test: app.test.ts builds and exercises this app
    // directly and does not want request-by-request debug logging drowning out
    // its own output; a real process never runs with NODE_ENV=test.
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: isProduction() ? "info" : "debug",
            // The login route carries a password in its body, so the logger is
            // never given bodies, and these headers are redacted explicitly.
            redact: ["req.headers.cookie", "req.headers.authorization"],
            ...(isProduction() ? {} : { transport: { target: "pino-pretty" } }),
          },
    trustProxy: server.trustProxy,
    bodyLimit: 1024 * 1024,
    /**
     * Fastify's router (find-my-way) defaults to 100 characters for a single
     * route-parameter segment — the tRPC adapter matches the whole batched
     * procedure path (e.g. `catalog.taxonomy.navigation,catalog.products.list`)
     * as one such segment, so a batch of even a handful of dotted procedure
     * names routinely exceeds it. Below the default, every batched GET query
     * fails with 414/FST_ERR_MAX_PARAM_LENGTH before it reaches a procedure —
     * discovered by a real batch of five storefront queries hitting exactly
     * this. `httpBatchLink`'s `maxURLLength` (set on every client) is the other
     * half of this fix, splitting an overlong batch into several requests
     * instead of emitting one that would be rejected; this is the server-side
     * floor in case a client — or a future one — doesn't set it.
     */
    maxParamLength: 5000,
  });

  await app.register(cors, {
    // An explicit allowlist, not a reflected origin. `credentials: true` with a
    // reflected origin would let any site make authenticated admin requests.
    origin: server.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-buildanta-client"],
    maxAge: 600,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
    hook: "onRequest",
  });

  await app.register(multipart, {
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 1,
      fields: 10,
    },
  });

  /**
   * CSRF defence for state-changing requests.
   *
   * Two independent checks. The `Origin` allowlist is the primary one. The custom
   * header is a second line that a classic HTML form post cannot produce: a
   * cross-site form can POST without triggering a preflight, but it cannot set a
   * custom header, so requiring one means every mutation has passed CORS.
   */
  app.addHook("onRequest", async (req, reply) => {
    if (
      req.method === "GET" ||
      req.method === "HEAD" ||
      req.method === "OPTIONS"
    ) {
      return;
    }

    const origin = req.headers.origin;
    if (origin && !server.corsOrigins.includes(origin)) {
      return reply.code(403).send({ error: "Cross-origin request refused." });
    }

    if (!req.headers["x-buildanta-client"]) {
      return reply
        .code(403)
        .send({ error: "Missing x-buildanta-client header." });
    }
  });

  app.get("/health", async () => {
    // Checks the database too: a process that cannot reach Postgres is not healthy,
    // and reporting otherwise makes a deploy look successful while the storefront
    // is actually down.
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", uptime: process.uptime() };
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: createFastifyContext,
      onError({ error, path, type }) {
        // Only genuine faults are logged as errors. UNAUTHORIZED, BAD_REQUEST and
        // TOO_MANY_REQUESTS are expected outcomes, and logging them at error level
        // trains everyone to ignore the log.
        if (error.code === "INTERNAL_SERVER_ERROR") {
          app.log.error({ err: error, path, type }, "tRPC handler failed");
        } else {
          app.log.debug(
            { code: error.code, path, type },
            "tRPC request rejected",
          );
        }
      },
      // Annotated so `onError`'s parameters are inferred from the router rather
      // than falling back to `any`.
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  registerUploadRoutes(app);

  return app;
}
