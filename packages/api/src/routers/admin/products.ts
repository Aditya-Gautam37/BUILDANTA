import type { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { removeOrphanedFiles } from "../../images.js";
import { withPrismaErrors } from "../../prisma-errors.js";
import {
  adminProductQuery,
  productInput,
  productStatus,
  uuid,
} from "../../schemas.js";
import {
  adminProductDetailSelect,
  serializeProductDetail,
} from "../../serializers.js";
import { adminProcedure, router } from "../../trpc.js";

function buildOrderBy(
  sort: z.infer<typeof adminProductQuery>["sort"],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "name-asc":
      return [{ name: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "updated":
    default:
      return [{ updatedAt: "desc" }];
  }
}

export const adminProductsRouter = router({
  list: adminProcedure
    .input(adminProductQuery)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProductWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(input.q
          ? {
              OR: [
                { name: { contains: input.q, mode: "insensitive" } },
                { slug: { contains: input.q, mode: "insensitive" } },
                {
                  variants: {
                    some: { sku: { contains: input.q, mode: "insensitive" } },
                  },
                },
              ],
            }
          : {}),
      };

      const [total, items] = await ctx.prisma.$transaction([
        ctx.prisma.product.count({ where }),
        ctx.prisma.product.findMany({
          where,
          orderBy: buildOrderBy(input.sort),
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            minPrice: true,
            priceCurrency: true,
            activeVariantCount: true,
            updatedAt: true,
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            images: {
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
              select: { id: true, url: true, altText: true },
            },
            _count: { select: { variants: true, images: true } },
          },
        }),
      ]);

      return {
        items: items.map(
          ({ _count, minPrice, priceCurrency, images, ...row }) => ({
            ...row,
            fromPrice: minPrice?.toFixed(2) ?? null,
            currency: priceCurrency?.trim() ?? null,
            variantCount: _count.variants,
            imageCount: _count.images,
            thumbnail: images[0] ?? null,
          }),
        ),
        total,
        page: input.page,
        limit: input.limit,
        pageCount: Math.max(1, Math.ceil(total / input.limit)),
      };
    }),

  /** Unlike the storefront read, this returns drafts and inactive variants. */
  byId: adminProcedure
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.product.findUnique({
        where: { id: input.id },
        select: adminProductDetailSelect,
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such product." });
      }
      return serializeProductDetail(row);
    }),

  create: adminProcedure.input(productInput).mutation(({ ctx, input }) =>
    withPrismaErrors(
      { entity: "product", fields: { slug: "URL slug" } },
      async () => {
        const { roomIds, stageIds, status, ...data } = input;

        // A product created straight into ACTIVE has no variants yet, so it would
        // appear on the storefront with no price. Publishing is a separate step
        // for that reason — see `setStatus`.
        if (status === "ACTIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Create the product as a draft, add at least one variant and an image, then publish it.",
          });
        }

        return ctx.prisma.product.create({
          data: {
            ...data,
            status,
            rooms: { connect: roomIds.map((id) => ({ id })) },
            stages: { connect: stageIds.map((id) => ({ id })) },
          },
          select: { id: true },
        });
      },
    ),
  ),

  update: adminProcedure
    .input(productInput.extend({ id: uuid }).omit({ status: true }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors(
        { entity: "product", fields: { slug: "URL slug" } },
        async () => {
          const { id, roomIds, stageIds, ...data } = input;

          await ctx.prisma.product.update({
            where: { id },
            data: {
              ...data,
              // `set` rather than `connect`: the form submits the complete list, so
              // anything absent has been deliberately removed.
              rooms: { set: roomIds.map((roomId) => ({ id: roomId })) },
              stages: { set: stageIds.map((stageId) => ({ id: stageId })) },
            },
          });

          return { success: true };
        },
      ),
    ),

  /**
   * Publish, unpublish or archive.
   *
   * Kept separate from `update` because it is the one catalog action with
   * customer-visible consequences, and it enforces preconditions a plain field
   * edit should not have to know about.
   */
  setStatus: adminProcedure
    .input(z.object({ id: uuid, status: productStatus }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "product" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          // Locked before the precondition read, and held until this transaction's
          // own write commits. Without this, a concurrent `variants.setActive`
          // deactivating the last active variant can commit in the gap between this
          // read and this write — the precondition passes on now-stale data, and the
          // product publishes with zero priced variants, which is the exact broken
          // state these preconditions exist to prevent.
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${input.id}::uuid FOR UPDATE`;

          const product = await tx.product.findUniqueOrThrow({
            where: { id: input.id },
            select: {
              publishedAt: true,
              activeVariantCount: true,
              _count: { select: { images: true } },
            },
          });

          if (input.status === "ACTIVE") {
            if (product.activeVariantCount === 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "Add at least one active variant with a price before publishing.",
              });
            }
            if (product._count.images === 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Add at least one product image before publishing.",
              });
            }
          }

          await tx.product.update({
            where: { id: input.id },
            data: {
              status: input.status,
              // Set once, on first publish, and never overwritten — it is the
              // original publication date, not the last status change.
              publishedAt:
                input.status === "ACTIVE" && !product.publishedAt
                  ? new Date()
                  : product.publishedAt,
            },
          });

          return { success: true };
        }),
      ),
    ),

  /**
   * Hard delete, allowed only for a product that was never published.
   *
   * Anything with a publication history is archived instead: quote requests
   * already reference these SKUs and Release 2 orders will too, so a catalog that
   * can erase its own history cannot answer "what did we quote them?".
   */
  delete: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "product" }, async () => {
        const storageKeys = await ctx.prisma.$transaction(async (tx) => {
          // Locked before the precondition read, for the same reason as
          // `setStatus`: without it, a concurrent `setStatus({status:'ACTIVE'})`
          // could commit its publish in the gap between this read and this
          // delete, and this would go on to hard-delete a product that — by the
          // time the delete statement actually runs — has just been published.
          // The precondition below is only meaningful if nothing can invalidate
          // it after it passes.
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${input.id}::uuid FOR UPDATE`;

          const product = await tx.product.findUniqueOrThrow({
            where: { id: input.id },
            select: {
              publishedAt: true,
              images: { select: { storageKey: true } },
            },
          });

          if (product.publishedAt) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This product has been published before, so it cannot be deleted. Archive it instead.",
            });
          }

          await tx.product.delete({ where: { id: input.id } });
          return product.images.map((image) => image.storageKey);
        });

        // Variants and image rows cascade at the database level, which leaves the
        // files behind. Cleaned up after the transaction commits, and failures
        // here are ignored — an unreferenced file is wasted disk, while throwing
        // would report a successful delete as an error.
        await removeOrphanedFiles(storageKeys);

        return { success: true };
      }),
    ),

  /** Populates the dropdowns and checkbox groups on the product form. */
  formOptions: adminProcedure.query(async ({ ctx }) => {
    const [categories, brands, rooms, stages] = await Promise.all([
      ctx.prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true, isActive: true },
      }),
      ctx.prisma.brand.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      ctx.prisma.room.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      ctx.prisma.constructionStage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { categories, brands, rooms, stages };
  }),
});
