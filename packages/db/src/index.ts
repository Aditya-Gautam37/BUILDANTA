import { PrismaClient, Prisma } from "@prisma/client";

/**
 * A single PrismaClient per process.
 *
 * Next.js dev mode re-evaluates modules on every hot reload; without the global
 * cache each reload opens a fresh connection pool until Postgres refuses new
 * connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma, PrismaClient };
export * from "@prisma/client";

/**
 * Prisma returns `Decimal` objects for money and measurement columns. They must
 * never reach a JSON serializer, where they arrive as `{}`, nor `Number`, which
 * loses precision. Convert at the boundary with these.
 */
export function decimalToString(value: Prisma.Decimal): string;
export function decimalToString(value: Prisma.Decimal | null): string | null;
export function decimalToString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/** Measurements keep their own precision rather than being forced to 2 places. */
export function measurementToString(
  value: Prisma.Decimal | null,
): string | null {
  return value === null ? null : value.toString();
}
