import type { AppRouter } from "@buildanta/api/client";
import { createTRPCReact } from "@trpc/react-query";

/**
 * Typed React hooks for the whole API, derived from the router type.
 *
 * There is no generated client and no hand-written fetch wrapper: `AppRouter` is the
 * contract, so renaming a procedure or changing an input becomes a type error here
 * rather than a runtime 400 in production.
 */
export const trpc = createTRPCReact<AppRouter>();

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
