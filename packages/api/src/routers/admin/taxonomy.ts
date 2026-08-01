import type { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { withPrismaErrors } from "../../prisma-errors.js";
import {
  brandInput,
  categoryInput,
  constructionStageInput,
  roomInput,
  uuid,
} from "../../schemas.js";
import { adminProcedure, router } from "../../trpc.js";

const byId = z.object({ id: uuid });
const setActive = z.object({ id: uuid, isActive: z.boolean() });

/**
 * `description` is included even though the table does not show it: the edit form is
 * seeded from this list, and seeding it with a blank description would silently
 * erase the real one on save.
 */
const labelListSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  _count: { select: { products: true } },
} satisfies Prisma.RoomSelect;

function withProductCount<T extends { _count: { products: number } }>(row: T) {
  const { _count, ...rest } = row;
  return { ...rest, productCount: _count.products };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Rejects a parent assignment that would create a cycle.
 *
 * Making a category its own ancestor is easy to do by accident in a dropdown and
 * yields a tree that recurses forever when rendered. Postgres cannot express this
 * constraint on a self-referencing table, so it is enforced on every write.
 */
async function assertNoCycle(
  prisma: Prisma.TransactionClient,
  categoryId: string,
  parentId: string,
): Promise<void> {
  if (categoryId === parentId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A category cannot be its own parent.",
    });
  }

  const all = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const parentOf = new Map(all.map((row) => [row.id, row.parentId]));

  let cursor = parentId as string | null;
  const seen = new Set<string>();

  while (cursor) {
    if (cursor === categoryId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "That parent sits underneath this category, which would create a loop.",
      });
    }
    // Stops on a pre-existing cycle rather than hanging while validating.
    if (seen.has(cursor)) break;
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
}

export const adminCategoriesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        // Included for the same reason as labelListSelect: the edit form is seeded
        // from this list.
        description: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
    });
    return rows.map(({ _count, ...row }) => ({
      ...row,
      productCount: _count.products,
      childCount: _count.children,
    }));
  }),

  byId: adminProcedure.input(byId).query(({ ctx, input }) =>
    ctx.prisma.category.findUniqueOrThrow({ where: { id: input.id } }),
  ),

  create: adminProcedure.input(categoryInput).mutation(({ ctx, input }) =>
    withPrismaErrors(
      { entity: "category", fields: { slug: "URL slug" } },
      async () => {
        if (input.parentId) {
          const parent = await ctx.prisma.category.findUnique({
            where: { id: input.parentId },
            select: { id: true },
          });
          if (!parent) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The chosen parent category does not exist.",
            });
          }
        }
        return ctx.prisma.category.create({ data: input });
      },
    ),
  ),

  update: adminProcedure
    .input(categoryInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors(
        { entity: "category", fields: { slug: "URL slug" } },
        async () => {
          const { id, ...data } = input;
          if (data.parentId) await assertNoCycle(ctx.prisma, id, data.parentId);
          return ctx.prisma.category.update({ where: { id }, data });
        },
      ),
    ),

  setActive: adminProcedure.input(setActive).mutation(({ ctx, input }) =>
    ctx.prisma.category.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
    }),
  ),

  /**
   * Only ever deletes an empty category. Reassigning products on delete would be a
   * silent bulk edit, so the admin is told to move them first.
   */
  delete: adminProcedure.input(byId).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "category" }, async () => {
      const category = await ctx.prisma.category.findUniqueOrThrow({
        where: { id: input.id },
        select: { _count: { select: { products: true, children: true } } },
      });

      if (category._count.products > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${category._count.products} product(s) are still in this category. Move them first, or deactivate the category instead.`,
        });
      }
      if (category._count.children > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Delete or move the sub-categories first.",
        });
      }

      await ctx.prisma.category.delete({ where: { id: input.id } });
      return { success: true };
    }),
  ),
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const adminBrandsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        websiteUrl: true,
        isActive: true,
        _count: { select: { products: true } },
      },
    });
    return rows.map(withProductCount);
  }),

  byId: adminProcedure.input(byId).query(({ ctx, input }) =>
    ctx.prisma.brand.findUniqueOrThrow({ where: { id: input.id } }),
  ),

  create: adminProcedure.input(brandInput).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "brand", fields: { slug: "URL slug" } }, () =>
      ctx.prisma.brand.create({ data: input }),
    ),
  ),

  update: adminProcedure
    .input(brandInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "brand", fields: { slug: "URL slug" } }, () => {
        const { id, ...data } = input;
        return ctx.prisma.brand.update({ where: { id }, data });
      }),
    ),

  setActive: adminProcedure.input(setActive).mutation(({ ctx, input }) =>
    ctx.prisma.brand.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
    }),
  ),

  delete: adminProcedure.input(byId).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "brand" }, async () => {
      const brand = await ctx.prisma.brand.findUniqueOrThrow({
        where: { id: input.id },
        select: { _count: { select: { products: true } } },
      });

      // The FK is SetNull, so deleting would succeed and quietly unbrand every
      // product. Refuse instead and make the editor decide.
      if (brand._count.products > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${brand._count.products} product(s) still reference this brand. Reassign them, or deactivate the brand instead.`,
        });
      }

      await ctx.prisma.brand.delete({ where: { id: input.id } });
      return { success: true };
    }),
  ),
});

// ---------------------------------------------------------------------------
// Rooms and build stages
// ---------------------------------------------------------------------------
// Structurally identical today, and a single factory over both Prisma delegates
// was tried first: it forces a union of two delegate types that TypeScript cannot
// call methods on without casts, and the casts defeat the point. Two explicit
// routers cost ~40 lines and stay honest — and `sortOrder` already means something
// different for a stage (build chronology) than for a room (display order).

export const adminRoomsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.room.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: labelListSelect,
    });
    return rows.map(withProductCount);
  }),

  byId: adminProcedure.input(byId).query(({ ctx, input }) =>
    ctx.prisma.room.findUniqueOrThrow({ where: { id: input.id } }),
  ),

  create: adminProcedure.input(roomInput).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "room", fields: { slug: "URL slug" } }, () =>
      ctx.prisma.room.create({ data: input }),
    ),
  ),

  update: adminProcedure
    .input(roomInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors({ entity: "room", fields: { slug: "URL slug" } }, () => {
        const { id, ...data } = input;
        return ctx.prisma.room.update({ where: { id }, data });
      }),
    ),

  setActive: adminProcedure.input(setActive).mutation(({ ctx, input }) =>
    ctx.prisma.room.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
    }),
  ),

  /** Safe: only the join rows go with it, no product is lost. */
  delete: adminProcedure.input(byId).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "room" }, async () => {
      await ctx.prisma.room.delete({ where: { id: input.id } });
      return { success: true };
    }),
  ),
});

export const adminStagesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.constructionStage.findMany({
      orderBy: { sortOrder: "asc" },
      select: labelListSelect,
    });
    return rows.map(withProductCount);
  }),

  byId: adminProcedure.input(byId).query(({ ctx, input }) =>
    ctx.prisma.constructionStage.findUniqueOrThrow({ where: { id: input.id } }),
  ),

  create: adminProcedure
    .input(constructionStageInput)
    .mutation(({ ctx, input }) =>
      withPrismaErrors(
        { entity: "build stage", fields: { slug: "URL slug" } },
        () => ctx.prisma.constructionStage.create({ data: input }),
      ),
    ),

  update: adminProcedure
    .input(constructionStageInput.extend({ id: uuid }))
    .mutation(({ ctx, input }) =>
      withPrismaErrors(
        { entity: "build stage", fields: { slug: "URL slug" } },
        () => {
          const { id, ...data } = input;
          return ctx.prisma.constructionStage.update({ where: { id }, data });
        },
      ),
    ),

  setActive: adminProcedure.input(setActive).mutation(({ ctx, input }) =>
    ctx.prisma.constructionStage.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
    }),
  ),

  delete: adminProcedure.input(byId).mutation(({ ctx, input }) =>
    withPrismaErrors({ entity: "build stage" }, async () => {
      await ctx.prisma.constructionStage.delete({ where: { id: input.id } });
      return { success: true };
    }),
  ),
});
