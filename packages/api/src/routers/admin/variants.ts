import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "../../env.js";
import { recomputeProductPricing } from "../../pricing.js";
import { withPrismaErrors } from "../../prisma-errors.js";
import { productVariantInput, uuid } from "../../schemas.js";
import { serializeVariant, variantSelect } from "../../serializers.js";
import { adminProcedure, router } from "../../trpc.js";

/**
 * Every mutation here runs inside a transaction that also calls
 * `recomputeProductPricing`. The denormalized price columns on Product drive
 * storefront sorting and filtering, so a variant write that skips the recompute
 * leaves the catalog showing a wrong price — the most important invariant in this
 * release.
 */
export const adminVariantsRouter = router({
  byProduct: adminProcedure
    .input(z.object({ productId: uuid }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.productVariant.findMany({
        where: { productId: input.productId },
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        select: variantSelect,
      });
      return rows.map(serializeVariant);
    }),

  create: adminProcedure.input(productVariantInput).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "variant", fields: { sku: "SKU" } }, () =>
      ctx.prisma.$transaction(async (tx) => {
        // Locks the product row before reading `activeVariantCount`. Without this,
        // two concurrent "add the first variant" requests for the same new product
        // can each read a count of 0 and each decide *they* are the default — the
        // same race fixed in packages/api/src/images.ts for the analogous
        // "count existing rows, then insert a new one based on that count" pattern.
        // A lock on an existing row can't protect an insert of a brand new one;
        // only locking the parent row both requests read first can.
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${input.productId}::uuid FOR UPDATE`;

        const product = await tx.product.findUnique({
          where: { id: input.productId },
          select: { id: true, activeVariantCount: true },
        });
        if (!product) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That product does not exist.",
          });
        }

        // The first variant is the default whether or not the form said so,
        // otherwise a product can end up with no default and no "from" price.
        const isDefault = input.isDefault || product.activeVariantCount === 0;

        if (isDefault) {
          await tx.productVariant.updateMany({
            where: { productId: input.productId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const variant = await tx.productVariant.create({
          data: {
            ...input,
            isDefault,
            currency: input.currency ?? env().DEFAULT_CURRENCY,
          },
          select: variantSelect,
        });

        await recomputeProductPricing(tx, input.productId);
        return serializeVariant(variant);
      }),
    ),
  ),

  update: adminProcedure
    .input(productVariantInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "variant", fields: { sku: "SKU" } }, () =>
        ctx.prisma.$transaction(async (tx) => {
          // Locked first, before any read: see the comment on this same pattern in
          // `create` above. `setStatus` (admin/products.ts) takes the same lock
          // before checking whether a product can be published, and the two need
          // to serialise against each other consistently or neither is actually
          // safe — a precondition check is only as good as its ability to block a
          // concurrent write from invalidating it mid-flight.
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${input.productId}::uuid FOR UPDATE`;

          const existing = await tx.productVariant.findUnique({
            where: { id: input.id },
            select: { productId: true },
          });
          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "That variant no longer exists.",
            });
          }
          // Moving a variant between products would change two products' prices and
          // orphan its images. Not supported; delete and recreate instead.
          if (existing.productId !== input.productId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A variant cannot be moved to a different product.",
            });
          }

          const { id, ...data } = input;

          if (data.isDefault) {
            await tx.productVariant.updateMany({
              where: {
                productId: existing.productId,
                isDefault: true,
                id: { not: id },
              },
              data: { isDefault: false },
            });
          }

          const variant = await tx.productVariant.update({
            where: { id },
            data: { ...data, currency: data.currency ?? env().DEFAULT_CURRENCY },
            select: variantSelect,
          });

          await recomputeProductPricing(tx, existing.productId);
          return serializeVariant(variant);
        }),
      ),
    ),

  setActive: adminProcedure
    .input(z.object({ id: uuid, isActive: z.boolean() }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "variant" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          // A variant's productId is immutable (see `update`'s comment on why
          // moving a variant between products isn't supported), so reading it
          // before the lock is safe. Everything read afterward — `isDefault`,
          // whether to promote a replacement, `activeVariantCount` — must be read
          // fresh, under the lock, or this has the same gap `setStatus` (in
          // admin/products.ts) closes on its side: the two would each see a
          // consistent snapshot only by coincidence, not by guarantee.
          const { productId } = await tx.productVariant.findUniqueOrThrow({
            where: { id: input.id },
            select: { productId: true },
          });
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;

          const before = await tx.productVariant.findUniqueOrThrow({
            where: { id: input.id },
            select: { isDefault: true },
          });

          // Deactivating the current default leaves no active variant marked
          // default — the same state `delete` already guards against. The flag is
          // cleared on this variant and promoted to the cheapest remaining active
          // one, matching what the "from" price shows. Clearing it matters beyond
          // the storefront (which filters inactive variants out anyway): the
          // admin's own variant table shows inactive variants too, and an inactive
          // one left wearing a "default" badge above the real functional default
          // would be a confusing, actively wrong thing to show whoever is editing.
          if (!input.isActive && before.isDefault) {
            const replacement = await tx.productVariant.findFirst({
              where: {
                productId,
                isActive: true,
                id: { not: input.id },
              },
              orderBy: { price: "asc" },
              select: { id: true },
            });
            await tx.productVariant.update({
              where: { id: input.id },
              data: {
                isActive: input.isActive,
                isDefault: false,
              },
            });
            if (replacement) {
              await tx.productVariant.update({
                where: { id: replacement.id },
                data: { isDefault: true },
              });
            }
          } else {
            await tx.productVariant.update({
              where: { id: input.id },
              data: { isActive: input.isActive },
            });
          }

          await recomputeProductPricing(tx, productId);

          // Deactivating the last active variant would leave a published product on
          // the storefront with no price at all, so it is unpublished too.
          const product = await tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { status: true, activeVariantCount: true },
          });

          const unpublished =
            product.status === "ACTIVE" && product.activeVariantCount === 0;

          if (unpublished) {
            await tx.product.update({
              where: { id: productId },
              data: { status: "DRAFT" },
            });
          }

          return { success: true, productUnpublished: unpublished };
        }),
      ),
    ),

  setDefault: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "variant" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: input.id },
            select: { productId: true, isActive: true },
          });

          if (!variant.isActive) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "An inactive variant cannot be the default.",
            });
          }

          await tx.productVariant.updateMany({
            where: { productId: variant.productId, isDefault: true },
            data: { isDefault: false },
          });
          await tx.productVariant.update({
            where: { id: input.id },
            data: { isDefault: true },
          });

          return { success: true };
        }),
      ),
    ),

  delete: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "variant" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          // productId is immutable; safe to read before the lock. Everything else
          // — isDefault, the quote-item count, and eventually activeVariantCount —
          // must be read after it, for the same reason as `setActive` above: this
          // mutation changes activeVariantCount, and `setStatus`
          // (admin/products.ts) only checks that count safely if every mutation
          // that can change it locks the product first too.
          const { productId } = await tx.productVariant.findUniqueOrThrow({
            where: { id: input.id },
            select: { productId: true },
          });
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;

          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: input.id },
            select: {
              isDefault: true,
              _count: { select: { quoteItems: true } },
            },
          });

          // A quoted SKU cannot be erased. The quote line keeps its own copy of the
          // name and price, but the soft link is what lets staff open the product
          // from a request, so deactivating is the right move.
          if (variant._count.quoteItems > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `This variant appears in ${variant._count.quoteItems} quote request(s), so it cannot be deleted. Deactivate it instead.`,
            });
          }

          await tx.productVariant.delete({ where: { id: input.id } });

          // Promote a replacement default so the product is never left without one.
          // Cheapest active variant, matching what the "from" price shows.
          if (variant.isDefault) {
            const replacement = await tx.productVariant.findFirst({
              where: { productId, isActive: true },
              orderBy: { price: "asc" },
              select: { id: true },
            });
            if (replacement) {
              await tx.productVariant.update({
                where: { id: replacement.id },
                data: { isDefault: true },
              });
            }
          }

          await recomputeProductPricing(tx, productId);
          return { success: true };
        }),
      ),
    ),
});
