"use client";

import type { AppRouter } from "@buildanta/api/client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Browser-side API client, used only by the quote basket.
 *
 * The rest of the storefront is server-rendered. This exists because the basket
 * lives in the visitor's browser (see lib/quote-basket.tsx) and has to resolve its
 * stored variant ids and submit the request from there.
 *
 * `NEXT_PUBLIC_API_URL` is not used: the storefront's API URL is a server secret in
 * the general case, so the basket goes through this app's own `/api/trpc` proxy
 * route instead, which keeps the API origin off the public page.
 */
export const browserApi = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: () => ({ "x-buildanta-client": "storefront" }),
      // See the comment on this same option in lib/api.ts: without it, a batch
      // of several dotted procedure names can produce a URL longer than the
      // API's route-parameter limit and fail with 414 before reaching a
      // procedure.
      maxURLLength: 2000,
    }),
  ],
});
