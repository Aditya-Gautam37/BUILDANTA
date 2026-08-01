import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({
  // superjson keeps Date round-tripping correctly. Prisma Decimal values are
  // converted to strings by ./serializers.ts before they reach this layer — a
  // Decimal handed to a JSON serializer arrives as `{}`.
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // `shape.data` can carry a `stack` property with the full server-side call
    // stack — absolute file paths, node_modules internals, everything. Whether
    // that happens depends on tRPC's own internal default, which is not a
    // contract this codebase should depend on; it is stripped here explicitly so
    // a client can never receive it, in any environment. Server-side visibility
    // into the real stack is `onError`'s job (apps/api/src/server.ts), which logs
    // it — that is the correct place to see it, not the HTTP response.
    const { stack: _stack, ...data } = shape.data;

    return {
      ...shape,
      data: {
        ...data,
        // Field-level validation errors, so forms can highlight the offending
        // input instead of showing one opaque message.
        fieldErrors:
          error.cause instanceof ZodError
            ? error.cause.flatten().fieldErrors
            : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

/** Storefront-facing. Reads published catalog data and accepts quote requests. */
export const publicProcedure = t.procedure;

/**
 * Requires a valid admin session. Narrows `ctx.admin` to non-null for every
 * procedure built from it, so no resolver can forget the check.
 */
export const adminProcedure = t.procedure.use(
  middleware(({ ctx, next }) => {
    if (!ctx.admin) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be signed in to do that.",
      });
    }
    return next({ ctx: { ...ctx, admin: ctx.admin } });
  }),
);
