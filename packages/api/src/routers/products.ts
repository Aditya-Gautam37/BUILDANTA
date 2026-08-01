import type { Prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { productQuery, slug as slugSchema, uuid } from "../schemas.js";
import type { ProductQuery } from "../schemas.js";
import {
  productDetailSelect,
  productListSelect,
  serializeProductDetail,
  serializeProductListItem,
  serializeVariant,
  variantSelect,
} from "../serializers.js";
import { publicProcedure, router } from "../trpc.js";

/**
 * Every storefront read is scoped to this. A DRAFT or ARCHIVED product must be
 * unreachable from the public app even by guessing its slug, so the constraint
 * lives in the query rather than in a UI check.
 */
const PUBLIC_SCOPE = { status: "ACTIVE" as const };

/**
 * Resolves a category slug to that category and all of its descendants, so
 * browsing "Electrical" shows products filed under "Electrical > Wires & Cables".
 *
 * Walks a flat id/parentId list instead of a recursive CTE: the tree is small,
 * this keeps the query portable, and it costs one round trip either way.
 */
async function collectCategoryIds(
  prisma: Prisma.TransactionClient,
  categorySlug: string,
): Promise<string[]> {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, parentId: true },
  });

  const root = all.find((category) => category.slug === categorySlug);
  if (!root) return [];

  const childrenByParent = new Map<string, string[]>();
  for (const category of all) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentId, siblings);
  }

  const ids: string[] = [];
  const queue = [root.id];
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.pop()!;
    // Guards against a cycle from a bad parent assignment; without it a
    // self-referencing row would spin here forever.
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return ids;
}

interface WhereOptions {
  /** Dimension to leave out, used when computing that dimension's own facet. */
  omit?: "brand" | "room" | "stage" | "unit" | "price";
}

async function buildProductWhere(
  prisma: Prisma.TransactionClient,
  input: ProductQuery,
  { omit }: WhereOptions = {},
): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [PUBLIC_SCOPE];

  if (input.q) {
    // Release 1 search is substring matching across the fields a buyer actually
    // types: product name, summary and SKU. It is deliberately not Postgres
    // full-text search yet — ranked search deserves a tsvector column and a GIN
    // index, and that is scheduled rather than half-built. See README.
    and.push({
      OR: [
        { name: { contains: input.q, mode: "insensitive" } },
        { summary: { contains: input.q, mode: "insensitive" } },
        {
          variants: {
            some: {
              isActive: true,
              sku: { contains: input.q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (input.categorySlug) {
    const categoryIds = await collectCategoryIds(prisma, input.categorySlug);
    // An unknown slug must return nothing, not everything.
    and.push({ categoryId: { in: categoryIds } });
  }

  if (omit !== "brand" && input.brandSlugs?.length) {
    and.push({ brand: { slug: { in: input.brandSlugs } } });
  }

  if (omit !== "room" && input.roomSlugs?.length) {
    and.push({
      rooms: { some: { slug: { in: input.roomSlugs }, isActive: true } },
    });
  }

  if (omit !== "stage" && input.stageSlugs?.length) {
    and.push({
      stages: { some: { slug: { in: input.stageSlugs }, isActive: true } },
    });
  }

  if (omit !== "unit" && input.units?.length) {
    and.push({
      variants: { some: { isActive: true, unit: { in: input.units } } },
    });
  }

  if (omit !== "price" && (input.minPrice || input.maxPrice)) {
    // Range overlap, not containment: a product priced 800–3000 is a valid result
    // for a 1000–2000 filter because it has variants in that band.
    if (input.maxPrice) and.push({ minPrice: { lte: input.maxPrice } });
    if (input.minPrice) and.push({ maxPrice: { gte: input.minPrice } });
  }

  return { AND: and };
}

function buildOrderBy(
  sort: ProductQuery["sort"],
  hasQuery: boolean,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      // Products with no priced variant sort last rather than first, which is
      // what a null would otherwise do.
      return [{ minPrice: { sort: "asc", nulls: "last" } }, { name: "asc" }];
    case "price-desc":
      return [{ maxPrice: { sort: "desc", nulls: "last" } }, { name: "asc" }];
    case "newest":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }];
    case "name-asc":
      return [{ name: "asc" }];
    case "relevance":
    default:
      // Without a ranked index there is no real relevance signal, so this is
      // honest about being a fallback rather than pretending to score.
      return hasQuery
        ? [{ name: "asc" }]
        : [{ publishedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }];
  }
}

export const productsRouter = router({
  list: publicProcedure.input(productQuery).query(async ({ ctx, input }) => {
    const where = await buildProductWhere(ctx.prisma, input);

    const [total, rows] = await ctx.prisma.$transaction([
      ctx.prisma.product.count({ where }),
      ctx.prisma.product.findMany({
        where,
        orderBy: buildOrderBy(input.sort, Boolean(input.q)),
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: productListSelect,
      }),
    ]);

    return {
      items: rows.map(serializeProductListItem),
      total,
      page: input.page,
      limit: input.limit,
      pageCount: Math.max(1, Math.ceil(total / input.limit)),
    };
  }),

  /**
   * Filter options with result counts for the current query.
   *
   * Each dimension is counted with the other filters applied but its own left out.
   * Otherwise selecting one brand would report zero for every other brand, and the
   * filter panel would be a dead end.
   */
  facets: publicProcedure.input(productQuery).query(async ({ ctx, input }) => {
    const [brandWhere, roomWhere, stageWhere, unitWhere, priceWhere] =
      await Promise.all([
        buildProductWhere(ctx.prisma, input, { omit: "brand" }),
        buildProductWhere(ctx.prisma, input, { omit: "room" }),
        buildProductWhere(ctx.prisma, input, { omit: "stage" }),
        buildProductWhere(ctx.prisma, input, { omit: "unit" }),
        buildProductWhere(ctx.prisma, input, { omit: "price" }),
      ]);

    const [brands, rooms, stages, units, priceRange] = await Promise.all([
      ctx.prisma.brand.findMany({
        where: { isActive: true, products: { some: brandWhere } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          _count: { select: { products: { where: brandWhere } } },
        },
      }),
      ctx.prisma.room.findMany({
        where: { isActive: true, products: { some: roomWhere } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          _count: { select: { products: { where: roomWhere } } },
        },
      }),
      ctx.prisma.constructionStage.findMany({
        where: { isActive: true, products: { some: stageWhere } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          _count: { select: { products: { where: stageWhere } } },
        },
      }),
      ctx.prisma.productVariant.groupBy({
        by: ["unit"],
        where: { isActive: true, product: unitWhere },
        _count: { _all: true },
      }),
      ctx.prisma.product.aggregate({
        where: priceWhere,
        _min: { minPrice: true },
        _max: { maxPrice: true },
      }),
    ]);

    const strip = <T extends { _count: { products: number } }>(row: T) => {
      const { _count, ...rest } = row;
      return { ...rest, count: _count.products };
    };

    return {
      brands: brands.map(strip),
      rooms: rooms.map(strip),
      stages: stages.map(strip),
      units: units
        .map((row) => ({ unit: row.unit, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      priceRange: {
        min: priceRange._min.minPrice?.toFixed(2) ?? null,
        max: priceRange._max.maxPrice?.toFixed(2) ?? null,
      },
    };
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.product.findFirst({
        where: { slug: input.slug, ...PUBLIC_SCOPE },
        select: productDetailSelect,
      });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such product." });
      }

      return serializeProductDetail(row);
    }),

  /** Same category, cheapest first. Used by the "related" strip. */
  related: publicProcedure
    .input(
      z.object({
        slug: slugSchema,
        limit: z.number().int().min(1).max(12).default(4),
      }),
    )
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.findFirst({
        where: { slug: input.slug, ...PUBLIC_SCOPE },
        select: { id: true, categoryId: true },
      });
      if (!product) return [];

      const rows = await ctx.prisma.product.findMany({
        where: {
          ...PUBLIC_SCOPE,
          categoryId: product.categoryId,
          id: { not: product.id },
        },
        orderBy: { minPrice: { sort: "asc", nulls: "last" } },
        take: input.limit,
        select: productListSelect,
      });

      return rows.map(serializeProductListItem);
    }),

  /**
   * Resolves variant ids to display data, for the quote basket.
   *
   * The basket lives in the browser as a list of ids and quantities; this is how it
   * renders names and prices without trusting anything the client stored. A variant
   * that has since been deactivated is simply absent from the result, which is what
   * lets the basket page tell the buyer it is no longer available.
   */
  variantsByIds: publicProcedure
    .input(z.object({ ids: z.array(uuid).min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.productVariant.findMany({
        where: {
          id: { in: input.ids },
          isActive: true,
          product: PUBLIC_SCOPE,
        },
        select: {
          ...variantSelect,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              images: {
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                take: 1,
                select: { url: true, altText: true },
              },
            },
          },
        },
      });

      return rows.map((row) => {
        const { product, ...variant } = row;
        return {
          ...serializeVariant(variant),
          product: {
            id: product.id,
            slug: product.slug,
            name: product.name,
            imageUrl: product.images[0]?.url ?? null,
            imageAlt: product.images[0]?.altText ?? null,
          },
        };
      });
    }),
});
