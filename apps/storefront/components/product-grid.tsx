import type { ProductListDto, ProductQuery } from "@buildanta/api/client";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { buildProductUrl } from "@/lib/search-params";

const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Name: A–Z" },
] as const;

export function ProductGrid({
  items,
  total,
  page,
  pageCount,
  query,
  basePath,
}: {
  items: ProductListDto[];
  total: number;
  page: number;
  pageCount: number;
  query: ProductQuery;
  basePath: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-concrete-200 bg-white p-10 text-center">
        <p className="text-lg font-semibold">No products match those filters</p>
        <p className="mt-1 text-sm text-concrete-600">
          Try removing a filter or widening the price range.
        </p>
        <Link
          href={basePath}
          className="mt-4 inline-block rounded bg-signal-600 px-4 py-2 text-sm font-medium text-white hover:bg-signal-700"
        >
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-concrete-600" aria-live="polite">
          {total} product{total === 1 ? "" : "s"}
        </p>

        {/* A GET form so sorting works without JavaScript; the other filters ride
            along as hidden inputs, same as the price form. */}
        <form action={basePath} method="get" className="flex items-center gap-2">
          <HiddenFilters query={query} />
          <label htmlFor="sort" className="text-sm text-concrete-600">
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={query.sort}
            className="rounded border border-concrete-200 bg-white px-2 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border border-concrete-400 px-3 py-1.5 text-sm hover:bg-concrete-100"
          >
            Apply
          </button>
        </form>
      </div>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => (
          <li key={product.id} className="flex">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageCount={pageCount}
        query={query}
        basePath={basePath}
      />
    </div>
  );
}

function HiddenFilters({ query }: { query: ProductQuery }) {
  const entries: [string, string][] = [];
  if (query.q) entries.push(["q", query.q]);
  if (query.minPrice) entries.push(["min", query.minPrice]);
  if (query.maxPrice) entries.push(["max", query.maxPrice]);
  for (const slug of query.brandSlugs ?? []) entries.push(["brand", slug]);
  for (const slug of query.roomSlugs ?? []) entries.push(["room", slug]);
  for (const slug of query.stageSlugs ?? []) entries.push(["stage", slug]);
  for (const unit of query.units ?? []) entries.push(["unit", unit]);

  return (
    <>
      {entries.map(([name, value], index) => (
        <input
          key={`${name}-${index}`}
          type="hidden"
          name={name}
          value={value}
        />
      ))}
    </>
  );
}

function Pagination({
  page,
  pageCount,
  query,
  basePath,
}: {
  page: number;
  pageCount: number;
  query: ProductQuery;
  basePath: string;
}) {
  if (pageCount <= 1) return null;

  // A window around the current page, so 200 pages do not render 200 links.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];
  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-1"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          href={buildProductUrl(basePath, query, { page: page - 1 })}
          rel="prev"
          className="rounded border border-concrete-200 bg-white px-3 py-1.5 text-sm hover:bg-concrete-100"
        >
          Previous
        </Link>
      ) : null}

      {pages.map((entry) => (
        <Link
          key={entry}
          href={buildProductUrl(basePath, query, { page: entry })}
          aria-current={entry === page ? "page" : undefined}
          className={`rounded px-3 py-1.5 text-sm ${
            entry === page
              ? "bg-concrete-900 font-semibold text-white"
              : "border border-concrete-200 bg-white hover:bg-concrete-100"
          }`}
        >
          {entry}
        </Link>
      ))}

      {page < pageCount ? (
        <Link
          href={buildProductUrl(basePath, query, { page: page + 1 })}
          rel="next"
          className="rounded border border-concrete-200 bg-white px-3 py-1.5 text-sm hover:bg-concrete-100"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
