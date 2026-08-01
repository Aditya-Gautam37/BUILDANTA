import type { Metadata } from "next";

import { CatalogResults } from "@/components/catalog-results";
import { parseProductSearchParams } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "All products",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const query = parseProductSearchParams(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {query.q ? `Results for “${query.q}”` : "All products"}
        </h1>
        {!query.q ? (
          <p className="mt-1 text-concrete-600">
            Filter by brand, build stage, room or price.
          </p>
        ) : null}
      </header>

      <CatalogResults basePath="/products" query={query} />
    </div>
  );
}
