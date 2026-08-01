import { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";

/**
 * Turns Prisma's constraint errors into messages an admin can act on.
 *
 * Constraint violations are normal, expected outcomes of a form submission — two
 * people picking the same slug is a Tuesday, not a server fault — so they get
 * first-class handling rather than a 500 with raw `P2002` text in it.
 */

interface LabelMap {
  /** Column name -> human label, e.g. `{ slug: "URL slug" }`. */
  fields?: Record<string, string>;
  /** What the record is called in prose, e.g. "category". */
  entity?: string;
}

export function toTRPCError(error: unknown, labels: LabelMap = {}): TRPCError {
  const entity = labels.entity ?? "record";

  // Already a deliberate error from a resolver — pass it through untouched rather
  // than flattening its message and code.
  if (error instanceof TRPCError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = error.meta?.["target"];
        const columns = Array.isArray(target)
          ? target.map(String)
          : typeof target === "string"
            ? [target]
            : [];
        const named = columns
          .map((column) => labels.fields?.[column] ?? column)
          .join(" and ");
        return new TRPCError({
          code: "CONFLICT",
          message: named
            ? `Another ${entity} already uses that ${named}.`
            : `Another ${entity} already exists with those details.`,
          cause: error,
        });
      }

      case "P2003":
      case "P2014":
        return new TRPCError({
          code: "CONFLICT",
          message: `That ${entity} is still referenced by other records, so it cannot be deleted. Deactivate it instead.`,
          cause: error,
        });

      case "P2025":
        return new TRPCError({
          code: "NOT_FOUND",
          message: `That ${entity} no longer exists — it may have been deleted in another tab.`,
          cause: error,
        });

      default:
        break;
    }
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not save the ${entity}.`,
    cause: error,
  });
}

/** Wraps a mutation body so every Prisma error gets translated once. */
export async function withPrismaErrors<T>(
  labels: LabelMap,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toTRPCError(error, labels);
  }
}
