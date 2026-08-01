import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { slug as slugSchema } from "../schemas.js";
import { publicProcedure, router } from "../trpc.js";

/**
 * Public taxonomy reads.
 *
 * Every menu in both apps is built from these procedures. The live prototype
 * hardcoded its stage, room and category menus separately and they drifted — ten
 * stages on the homepage, seven in the footer, three different category lists. One
 * query per axis is what makes that impossible here.
 */

/** Counts only products a visitor can actually reach. */
const publishedProductCount = {
  _count: { select: { products: { where: { status: "ACTIVE" as const } } } },
};

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  children: CategoryNode[];
}

export const taxonomyRouter = router({
  /**
   * The whole active category tree in one query.
   *
   * Nested categories are fetched flat and assembled in memory rather than with a
   * recursive `include`, which would need a fixed depth and one query per level.
   */
  categoryTree: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        ...publishedProductCount,
      },
    });

    const nodes = new Map<string, CategoryNode & { parentId: string | null }>();
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        productCount: row._count.products,
        parentId: row.parentId,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      // A child whose parent is inactive is promoted to a root rather than
      // dropped — otherwise deactivating one category would silently hide an
      // entire subtree of live products.
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return roots;
  }),

  categoryBySlug: publicProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { slug: input.slug, isActive: true },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          parent: { select: { id: true, slug: true, name: true } },
          children: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, slug: true, name: true },
          },
        },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such category.",
        });
      }
      return category;
    }),

  brands: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        ...publishedProductCount,
      },
    });
    return rows.map(({ _count, ...brand }) => ({
      ...brand,
      productCount: _count.products,
    }));
  }),

  rooms: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.room.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        ...publishedProductCount,
      },
    });
    return rows.map(({ _count, ...room }) => ({
      ...room,
      productCount: _count.products,
    }));
  }),

  /**
   * Build stages in `sortOrder`, which is the real chronology of work on site.
   * The storefront relies on that ordering for its stage-to-stage navigation, so
   * it is never re-sorted alphabetically at the call site.
   */
  stages: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.constructionStage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        ...publishedProductCount,
      },
    });
    return rows.map(({ _count, ...stage }) => ({
      ...stage,
      productCount: _count.products,
    }));
  }),

  /** Everything the header, footer and sitemap need, in one round trip. */
  navigation: publicProcedure.query(async ({ ctx }) => {
    const [categories, rooms, stages] = await Promise.all([
      ctx.prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          children: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, slug: true, name: true },
          },
        },
      }),
      ctx.prisma.room.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true },
      }),
      ctx.prisma.constructionStage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true },
      }),
    ]);

    return { categories, rooms, stages };
  }),
});
