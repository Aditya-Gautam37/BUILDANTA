import type { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { withPrismaErrors } from "../../prisma-errors.js";
import { adminQuoteQuery, quoteStatusUpdateInput, uuid } from "../../schemas.js";
import { quoteDetailSelect, serializeQuoteDetail } from "../../serializers.js";
import { adminProcedure, router } from "../../trpc.js";

/**
 * The quote inbox.
 *
 * Quote requests are never deleted from here. They are the record of what a buyer
 * asked for and what they were shown, and Release 2 turns accepted ones into
 * orders — so a mistaken or spam request is CLOSED, not erased.
 */
export const adminQuotesRouter = router({
  list: adminProcedure.input(adminQuoteQuery).query(async ({ ctx, input }) => {
    const where: Prisma.QuoteRequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              { reference: { contains: input.q, mode: "insensitive" } },
              { contactName: { contains: input.q, mode: "insensitive" } },
              { contactEmail: { contains: input.q, mode: "insensitive" } },
              { companyName: { contains: input.q, mode: "insensitive" } },
              { projectName: { contains: input.q, mode: "insensitive" } },
              // Searching a SKU finds every request that included it, which is how
              // staff answer "who else asked for this?".
              { items: { some: { sku: { contains: input.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.QuoteRequestOrderByWithRelationInput =
      input.sort === "oldest"
        ? { createdAt: "asc" }
        : input.sort === "updated"
          ? { updatedAt: "desc" }
          : { createdAt: "desc" };

    const [page, statusCounts] = await Promise.all([
      // Count and page in one transaction, so the total cannot disagree with the
      // rows returned alongside it.
      ctx.prisma.$transaction([
        ctx.prisma.quoteRequest.count({ where }),
        ctx.prisma.quoteRequest.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            reference: true,
            status: true,
            contactName: true,
            contactEmail: true,
            companyName: true,
            projectName: true,
            deliveryPincode: true,
            requiredBy: true,
            createdAt: true,
            assignedTo: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        }),
      ]),
      // Deliberately outside that transaction and unfiltered: these drive the
      // status tabs, which must show the full picture rather than counts of the
      // tab you are already on.
      ctx.prisma.quoteRequest.groupBy({
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
    ]);

    const [total, items] = page;

    return {
      items: items.map(({ _count, ...row }) => ({
        ...row,
        itemCount: _count.items,
      })),
      total,
      page: input.page,
      limit: input.limit,
      pageCount: Math.max(1, Math.ceil(total / input.limit)),
      statusCounts: Object.fromEntries(
        statusCounts.map((row) => [row.status, row._count._all]),
      ) as Record<string, number>,
    };
  }),

  byId: adminProcedure
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.quoteRequest.findUnique({
        where: { id: input.id },
        select: quoteDetailSelect,
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such quote request.",
        });
      }

      return serializeQuoteDetail(row);
    }),

  setStatus: adminProcedure
    .input(quoteStatusUpdateInput)
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "quote request" }, async () => {
        const existing = await ctx.prisma.quoteRequest.findUniqueOrThrow({
          where: { id: input.id },
          select: { respondedAt: true },
        });

        await ctx.prisma.quoteRequest.update({
          where: { id: input.id },
          data: {
            status: input.status,
            internalNotes: input.internalNotes,
            // Stamped once, when a quote first goes back to the buyer. It is the
            // response time metric, so a later status change must not reset it.
            respondedAt:
              input.status === "QUOTED" && !existing.respondedAt
                ? new Date()
                : existing.respondedAt,
          },
        });

        return { success: true };
      }),
    ),

  /** Claims a request, or hands it back by passing null. */
  assign: adminProcedure
    .input(
      z.object({
        id: uuid,
        assignedToId: uuid.nullish().transform((value) => value ?? null),
      }),
    )
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "quote request" }, async () => {
        await ctx.prisma.quoteRequest.update({
          where: { id: input.id },
          data: { assignedToId: input.assignedToId },
        });
        return { success: true };
      }),
    ),

  /** Staff who can be assigned a request. */
  assignees: adminProcedure.query(({ ctx }) =>
    ctx.prisma.adminUser.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ),
});
