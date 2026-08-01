import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { withPrismaErrors } from "../../prisma-errors.js";
import { imageMetadataInput, uuid } from "../../schemas.js";
import { imageSelect, serializeImage } from "../../serializers.js";
import * as storage from "../../storage.js";
import { adminProcedure, router } from "../../trpc.js";

/**
 * Image records. The upload itself is a multipart POST handled by `apps/api` (see
 * packages/api/src/images.ts for why); everything after the bytes land is here.
 */
export const adminImagesRouter = router({
  byProduct: adminProcedure
    .input(z.object({ productId: uuid }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.productImage.findMany({
        where: { productId: input.productId },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: imageSelect,
      });
      return rows.map(serializeImage);
    }),

  updateMetadata: adminProcedure
    .input(imageMetadataInput)
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "image" }, async () => {
        const { id, ...data } = input;

        // Re-checked here as well as on upload: this endpoint can move an existing
        // image onto a variant, and the same ownership rule applies.
        if (data.variantId) {
          const image = await ctx.prisma.productImage.findUniqueOrThrow({
            where: { id },
            select: { productId: true },
          });
          const variant = await ctx.prisma.productVariant.findUnique({
            where: { id: data.variantId },
            select: { productId: true },
          });
          if (!variant || variant.productId !== image.productId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "That variant does not belong to this product.",
            });
          }
        }

        const updated = await ctx.prisma.productImage.update({
          where: { id },
          data,
          select: imageSelect,
        });
        return serializeImage(updated);
      }),
    ),

  /**
   * Applies a new display order in one transaction.
   *
   * The client sends the complete ordered list rather than a moved-item delta, so a
   * dropped or duplicated request cannot leave two images sharing a position.
   */
  reorder: adminProcedure
    .input(
      z.object({
        productId: uuid,
        orderedIds: z.array(uuid).min(1).max(100),
      }),
    )
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "image" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          const owned = await tx.productImage.findMany({
            where: { productId: input.productId },
            select: { id: true },
          });
          const ownedIds = new Set(owned.map((image) => image.id));

          // Every id must belong to this product, and all of them must be present —
          // a partial list would silently renumber the rest.
          const mismatch =
            owned.length !== input.orderedIds.length ||
            input.orderedIds.some((id) => !ownedIds.has(id));

          if (mismatch) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "The image list is out of date. Reload the product and try again.",
            });
          }

          await Promise.all(
            input.orderedIds.map((id, index) =>
              tx.productImage.update({
                where: { id },
                data: { sortOrder: index },
              }),
            ),
          );

          return { success: true };
        }),
      ),
    ),

  setPrimary: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "image" }, () =>
        ctx.prisma.$transaction(async (tx) => {
          const image = await tx.productImage.findUniqueOrThrow({
            where: { id: input.id },
            select: { productId: true },
          });

          await tx.productImage.updateMany({
            where: { productId: image.productId, isPrimary: true },
            data: { isPrimary: false },
          });
          await tx.productImage.update({
            where: { id: input.id },
            data: { isPrimary: true },
          });

          return { success: true };
        }),
      ),
    ),

  delete: adminProcedure
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "image" }, async () => {
        const image = await ctx.prisma.productImage.findUniqueOrThrow({
          where: { id: input.id },
          select: { storageKey: true, productId: true, isPrimary: true },
        });

        await ctx.prisma.$transaction(async (tx) => {
          await tx.productImage.delete({ where: { id: input.id } });

          // Promote the next image so the product keeps a thumbnail.
          if (image.isPrimary) {
            const replacement = await tx.productImage.findFirst({
              where: { productId: image.productId },
              orderBy: { sortOrder: "asc" },
              select: { id: true },
            });
            if (replacement) {
              await tx.productImage.update({
                where: { id: replacement.id },
                data: { isPrimary: true },
              });
            }
          }
        });

        // Deliberately after the transaction commits. Deleting the file first would
        // break the product page if the transaction then rolled back, and an
        // unreferenced file is a much cheaper problem than a broken image.
        await storage.remove(image.storageKey);

        return { success: true };
      }),
    ),
});
