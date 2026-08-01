import type { MetadataRoute } from "next";

import { api } from "@/lib/api";

/**
 * Generated per request, not at build time.
 *
 * Route-segment config in a layout does not reach a metadata route, so this is
 * declared explicitly — otherwise `next build` would try to enumerate the catalog
 * and fail wherever the API and database are not reachable, such as CI.
 */
export const dynamic = "force-dynamic";

/**
 * Sitemap generated from the live catalog.
 *
 * The live prototype has no sitemap.xml, which for a catalog with hundreds of
 * category pages is the difference between being indexed and not. Built from the
 * database so it can never list a withdrawn product or miss a new one.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const [nav, categories] = await Promise.all([
    api.catalog.taxonomy.navigation.query(),
    api.catalog.taxonomy.categoryTree.query(),
  ]);

  // Paged through rather than fetched in one call: `limit` is capped at 100 server
  // side, and a real catalog will exceed that.
  const products: { slug: string; updatedAt?: Date }[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const result = await api.catalog.products.list.query({
      page,
      limit: 100,
      sort: "newest",
    });
    products.push(...result.items.map((item) => ({ slug: item.slug })));
    pageCount = result.pageCount;
    page += 1;
    // A hard ceiling so a catalog that grows unexpectedly cannot turn sitemap
    // generation into an unbounded loop of API calls.
  } while (page <= pageCount && page <= 50);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, priority: 1 },
    { url: `${siteUrl}/products`, priority: 0.9 },
    { url: `${siteUrl}/stages`, priority: 0.8 },
    { url: `${siteUrl}/rooms`, priority: 0.8 },
    { url: `${siteUrl}/categories`, priority: 0.8 },
    { url: `${siteUrl}/brands`, priority: 0.6 },
  ];

  const flatCategories = categories.flatMap((category) => [
    category,
    ...category.children,
  ]);

  return [
    ...staticEntries,
    ...nav.stages.map((stage) => ({
      url: `${siteUrl}/stages/${stage.slug}`,
      priority: 0.7,
    })),
    ...nav.rooms.map((room) => ({
      url: `${siteUrl}/rooms/${room.slug}`,
      priority: 0.7,
    })),
    ...flatCategories.map((category) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      priority: 0.6,
    })),
  ];
}
