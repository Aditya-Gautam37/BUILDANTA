import type { ProductQuery } from "@buildanta/api/client";

import { FilterPanel } from "@/components/filter-panel";
import { ProductGrid } from "@/components/product-grid";
import { api } from "@/lib/api";

/**
 * The filtered results view, shared by every browse route.
 *
 * `/products`, `/categories/[slug]`, `/rooms/[slug]` and `/stages/[slug]` are the
 * same view with one dimension pinned by the route. Defining it once means a change
 * to sorting or pagination cannot land on three of four pages — which is how the
 * live prototype ended up with different behaviour on each.
 */
export async function CatalogResults({
  basePath,
  query,
  hide = [],
}: {
  basePath: string;
  query: ProductQuery;
  hide?: ("brand" | "room" | "stage" | "unit")[];
}) {
  // One HTTP round trip for both, since the tRPC client batches concurrent calls.
  const [results, facets] = await Promise.all([
    api.catalog.products.list.query(query),
    api.catalog.products.facets.query(query),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <FilterPanel
        basePath={basePath}
        query={query}
        facets={facets}
        hide={hide}
      />
      <ProductGrid
        items={results.items}
        total={results.total}
        page={results.page}
        pageCount={results.pageCount}
        query={query}
        basePath={basePath}
      />
    </div>
  );
}
