import { TRPCClientError } from "@trpc/client";

/**
 * Turns an unknown thrown value into something an admin can read.
 *
 * The API already returns actionable messages (see packages/api/src/prisma-errors.ts),
 * so the job here is to surface them rather than replace them with a generic
 * "something went wrong" — which is what makes an admin unusable when a slug
 * collides.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Per-field validation errors, for highlighting the offending input. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  if (!(error instanceof TRPCClientError)) return {};
  const data = error.data as
    | { fieldErrors?: Record<string, string[]> | null }
    | undefined;
  return data?.fieldErrors ?? {};
}

/** True when the session has lapsed, so the caller can redirect to login. */
export function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED"
  );
}
