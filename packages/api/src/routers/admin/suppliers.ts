import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { withPrismaErrors } from "../../prisma-errors.js";
import { pagination, supplierInput, uuid } from "../../schemas.js";
import { adminProcedure, router } from "../../trpc.js";

/**
 * Supplier records only. Purchase orders, goods receipts and stock are Release 3;
 * seller self-onboarding is Release 4. Nothing here anticipates either.
 */
export const adminSuppliersRouter = router({
  list: adminProcedure
    .input(
      pagination.extend({
        q: z.string().trim().max(200).optional(),
        includeInactive: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.includeInactive ? {} : { isActive: true }),
        ...(input.q
          ? {
              OR: [
                { name: { contains: input.q, mode: "insensitive" as const } },
                { city: { contains: input.q, mode: "insensitive" as const } },
                {
                  contactEmail: {
                    contains: input.q,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      };

      const [total, items] = await ctx.prisma.$transaction([
        ctx.prisma.supplier.count({ where }),
        ctx.prisma.supplier.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          // Every editable column is selected, not just the ones the table shows.
          // The edit form is seeded from this list, and seeding it with blanks
          // would silently wipe an address or a note on save.
          select: {
            id: true,
            slug: true,
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            notes: true,
            isActive: true,
            _count: { select: { variants: true } },
          },
        }),
      ]);

      return {
        items: items.map(({ _count, ...row }) => ({
          ...row,
          variantCount: _count.variants,
        })),
        total,
        page: input.page,
        limit: input.limit,
        pageCount: Math.max(1, Math.ceil(total / input.limit)),
      };
    }),

  /** Populates the supplier dropdown on the variant form. Active only. */
  options: adminProcedure.query(({ ctx }) =>
    ctx.prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ),

  byId: adminProcedure.input(z.object({ id: uuid })).query(({ ctx, input }) =>
    ctx.prisma.supplier.findUniqueOrThrow({ where: { id: input.id } }),
  ),

  create: adminProcedure.input(supplierInput).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "supplier", fields: { slug: "URL slug" } }, () =>
      ctx.prisma.supplier.create({ data: input }),
    ),
  ),

  update: adminProcedure
    .input(supplierInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors(
        { entity: "supplier", fields: { slug: "URL slug" } },
        () => {
          const { id, ...data } = input;
          return ctx.prisma.supplier.update({ where: { id }, data });
        },
      ),
    ),

  setActive: adminProcedure
    .input(z.object({ id: uuid, isActive: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.supplier.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "supplier" }, async () => {
        const supplier = await ctx.prisma.supplier.findUniqueOrThrow({
          where: { id: input.id },
          select: { _count: { select: { variants: true } } },
        });

        // The variant FK is SetNull, so a delete would silently orphan sourcing
        // information someone will need when Release 3 adds purchasing.
        if (supplier._count.variants > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `${supplier._count.variants} variant(s) are sourced from this supplier. Reassign them, or deactivate the supplier instead.`,
          });
        }

        await ctx.prisma.supplier.delete({ where: { id: input.id } });
        return { success: true };
      }),
    ),
});
