"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";

import { isUnauthorized } from "@/lib/errors";
import { apiUrl, trpc } from "@/lib/trpc";

export function Providers({ children }: { children: React.ReactNode }) {
  // Created inside state, not at module scope: a module-level client would be shared
  // across requests on the server and could leak one admin's cached data into
  // another's render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Retrying an expired session just delays the redirect to login.
            retry: (failureCount, error) =>
              !isUnauthorized(error) && failureCount < 2,
            refetchOnWindowFocus: false,
          },
          // Never retried: a mutation that may have partially succeeded must not be
          // replayed automatically.
          mutations: { retry: false },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          transformer: superjson,
          fetch: (url, options) =>
            fetch(url, {
              ...options,
              // Required for the session cookie to reach the API, which is a
              // different origin. Without it every request is anonymous.
              credentials: "include",
            }),
          // The API rejects mutations without this header as CSRF defence; a
          // cross-site form post cannot set it.
          headers: () => ({ "x-buildanta-client": "admin" }),
          // Several screens fire multiple queries in the same render (the
          // overview page alone batches three), and React Query's own batching
          // combines them into one request the same way Next.js Server
          // Components do on the storefront. Without this, enough of them
          // together can produce a URL longer than the API's route-parameter
          // limit and fail with 414 before reaching a procedure — see the
          // longer explanation in apps/storefront/lib/api.ts, where this was
          // actually hit and diagnosed.
          maxURLLength: 2000,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
