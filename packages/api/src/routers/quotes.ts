import { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";

import { withPrismaErrors } from "../prisma-errors.js";
import { consume } from "../rate-limit.js";
import { quoteRequestInput } from "../schemas.js";
import { publicProcedure, router } from "../trpc.js";

/**
 * Bulk quote requests — the one marketplace feature buildanta.com advertises as a
 * headline and has no form behind.
 *
 * A quote request is explicitly not an order: nothing here reserves stock, agrees
 * a price or takes payment. It records what a buyer asked for, at the prices they
 * were shown, and who to call back.
 */

/** Five submissions per IP per hour. Generous for a real buyer, useless for a bot. */
const QUOTE_LIMIT = 5;
const QUOTE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Allocates the next human-readable reference, e.g. "BQ-2026-0007".
 *
 * A per-year counter row rather than a Postgres sequence, because references
 * restart each year and a sequence cannot be reset transactionally alongside the
 * insert. The `update` path takes a row lock, so concurrent requests serialise;
 * only the very first request of a new year can collide on insert, which is what
 * the retry covers.
 */
async function nextReference(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await tx.quoteReferenceCounter.upsert({
        where: { year },
        update: { lastValue: { increment: 1 } },
        create: { year, lastValue: 1 },
      });
      return `BQ-${year}-${String(counter.lastValue).padStart(4, "0")}`;
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isUniqueViolation || attempt === 2) throw error;
      // Another request created this year's row first; loop and take the update
      // path instead.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not allocate a quote reference.",
  });
}

export const quotesRouter = router({
  /**
   * Submits a quote request.
   *
   * Prices, SKUs, units and product names are read from the database here and
   * copied onto the request. The client sends only variant ids and quantities —
   * accepting a client-supplied price would let anyone request a quote at a price
   * of their choosing and then argue it was what the site displayed.
   */
  submit: publicProcedure
    .input(quoteRequestInput)
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.request.ipAddress ?? "unknown";
      const { allowed, retryAfterSeconds } = consume(
        `quote:ip:${ip}`,
        QUOTE_LIMIT,
        QUOTE_WINDOW_MS,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You have submitted several requests already. Please try again in ${Math.ceil(
            retryAfterSeconds / 60,
          )} minute(s), or call us.`,
        });
      }

      // Duplicate variant ids would produce two lines for the same SKU. Merge them
      // by adding the quantities, which is what the buyer meant.
      const merged = new Map<string, { quantity: Prisma.Decimal; note: string | null }>();
      for (const item of input.items) {
        const existing = merged.get(item.variantId);
        const quantity = new Prisma.Decimal(item.quantity);
        if (existing) {
          existing.quantity = existing.quantity.add(quantity);
          existing.note = existing.note ?? item.note;
        } else {
          merged.set(item.variantId, { quantity, note: item.note });
        }
      }

      const variantIds = [...merged.keys()];

      const variants = await ctx.prisma.productVariant.findMany({
        where: {
          id: { in: variantIds },
          isActive: true,
          product: { status: "ACTIVE" },
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          price: true,
          currency: true,
          product: { select: { name: true } },
        },
      });

      if (variants.length !== variantIds.length) {
        // Named rather than silently dropped: a buyer who filled in a long form
        // must be told which line is the problem, not have it vanish.
        const found = new Set(variants.map((variant) => variant.id));
        const missing = variantIds.filter((id) => !found.has(id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            missing.length === variantIds.length
              ? "None of those products are available any more. Please refresh and try again."
              : `${missing.length} of the products in your request are no longer available. Please remove them and resubmit.`,
        });
      }

      return withPrismaErrors({ entity: "quote request" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          const reference = await nextReference(tx);

          const created = await tx.quoteRequest.create({
            data: {
              reference,
              contactName: input.contactName,
              contactEmail: input.contactEmail,
              contactPhone: input.contactPhone,
              companyName: input.companyName,
              projectName: input.projectName,
              deliveryPincode: input.deliveryPincode,
              message: input.message,
              // Parsed as a UTC midnight date: this is a calendar date the buyer
              // picked, not an instant, and storing it with the server's local
              // offset would shift it a day for some readers.
              requiredBy: input.requiredBy
                ? new Date(`${input.requiredBy}T00:00:00.000Z`)
                : null,
              ipAddress: ctx.request.ipAddress,
              userAgent: ctx.request.userAgent?.slice(0, 500) ?? null,
              items: {
                create: variants.map((variant) => {
                  const line = merged.get(variant.id)!;
                  return {
                    variantId: variant.id,
                    productName: variant.product.name,
                    variantName: variant.name,
                    sku: variant.sku,
                    unit: variant.unit,
                    unitPrice: variant.price,
                    currency: variant.currency,
                    quantity: line.quantity,
                    note: line.note,
                  };
                }),
              },
            },
            select: { id: true, reference: true, createdAt: true },
          });

          // Release 2 adds the confirmation email. Until then the reference is
          // what the buyer is shown and what staff search on, so it is returned
          // rather than kept internal.
          return created;
        }),
      );
    }),
});
