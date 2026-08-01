import type { AppRouter } from "@buildanta/api/client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Server-side API client for the storefront.
 *
 * Catalog reads happen in Server Components, so no API URL or credential ever
 * reaches the browser for them. The quote basket is the one client-side caller and
 * has its own client in lib/browser-api.ts.
 */
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
      transformer: superjson,
      // The API requires this header on mutations as CSRF defence. Sent uniformly
      // so both apps behave identically.
      headers: () => ({ "x-buildanta-client": "storefront" }),
      /**
       * A batch of several dotted procedure names (this layout alone batches
       * five: navigation plus the homepage's four) easily produces a comma-joined
       * path longer than Fastify's default 100-character route-parameter limit —
       * the request then fails with 414/FST_ERR_MAX_PARAM_LENGTH before it ever
       * reaches a procedure. Below this length, `httpBatchLink` automatically
       * splits one oversized batch into several smaller requests instead of
       * emitting a URL that could be rejected — by this server's Fastify config
       * (see apps/api/src/server.ts, which raises the limit as the other half of
       * this fix) or by a proxy/CDN with its own limit in front of a real
       * deployment.
       *
       * Release 1 renders every page per request. Incremental static
       * regeneration is the right end state for a catalog and is a deliberate
       * follow-up: it requires the API to be reachable during `next build`,
       * which is a deployment-pipeline decision. When that lands, this link
       * gets `next: { revalidate: 60 }` instead of relying on `force-dynamic`.
       */
      maxURLLength: 2000,
    }),
  ],
});
