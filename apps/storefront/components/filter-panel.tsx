import { formatUnit } from "@buildanta/api/client";
import type { ProductQuery } from "@buildanta/api/client";
import Link from "next/link";

import { buildProductUrl, toggleFilterUrl } from "@/lib/search-params";

interface FacetOption {
  id: string;
  slug: string;
  name: string;
  count: number;
}

export interface Facets {
  brands: FacetOption[];
  rooms: FacetOption[];
  stages: FacetOption[];
  units: { unit: string; count: number }[];
  priceRange: { min: string | null; max: string | null };
}

/**
 * Filters render as links, not checkboxes with an onChange handler.
 *
 * A deliberate choice: every filter combination becomes a real URL the server can
 * render, the panel works with JavaScript disabled, and there is no client-side
 * state that can disagree with what the page is actually showing.
 */
export function FilterPanel({
  basePath,
  query,
  facets,
  /** Dimensions fixed by the route itself, e.g. room on /rooms/[slug]. */
  hide = [],
}: {
  basePath: string;
  query: ProductQuery;
  facets: Facets;
  hide?: ("brand" | "room" | "stage" | "unit")[];
}) {
  const hidden = new Set(hide);
  const activeCount =
    (query.brandSlugs?.length ?? 0) +
    (query.roomSlugs?.length ?? 0) +
    (query.stageSlugs?.length ?? 0) +
    (query.units?.length ?? 0) +
    (query.minPrice ? 1 : 0) +
    (query.maxPrice ? 1 : 0);

  return (
    <aside className="space-y-6" aria-label="Filters">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-concrete-600">
          Filters
        </h2>
        {activeCount > 0 ? (
          <Link
            href={buildProductUrl(basePath, query, {
              brand: undefined,
              room: undefined,
              stage: undefined,
              unit: undefined,
              min: undefined,
              max: undefined,
              page: undefined,
            })}
            className="text-xs font-medium text-signal-700 hover:underline"
          >
            Clear all ({activeCount})
          </Link>
        ) : null}
      </div>

      {!hidden.has("brand") && facets.brands.length > 0 ? (
        <FacetGroup
          title="Brand"
          options={facets.brands}
          selected={query.brandSlugs ?? []}
          href={(slug) => toggleFilterUrl(basePath, query, "brand", slug)}
        />
      ) : null}

      {!hidden.has("stage") && facets.stages.length > 0 ? (
        <FacetGroup
          title="Build stage"
          options={facets.stages}
          selected={query.stageSlugs ?? []}
          href={(slug) => toggleFilterUrl(basePath, query, "stage", slug)}
        />
      ) : null}

      {!hidden.has("room") && facets.rooms.length > 0 ? (
        <FacetGroup
          title="Room"
          options={facets.rooms}
          selected={query.roomSlugs ?? []}
          href={(slug) => toggleFilterUrl(basePath, query, "room", slug)}
        />
      ) : null}

      {!hidden.has("unit") && facets.units.length > 1 ? (
        <FacetGroup
          title="Sold by"
          options={facets.units.map((entry) => ({
            id: entry.unit,
            slug: entry.unit,
            name: formatUnit(entry.unit, "long"),
            count: entry.count,
          }))}
          selected={query.units ?? []}
          href={(unit) => toggleFilterUrl(basePath, query, "unit", unit)}
        />
      ) : null}

      <PriceFilter basePath={basePath} query={query} facets={facets} />
    </aside>
  );
}

function FacetGroup({
  title,
  options,
  selected,
  href,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  href: (slug: string) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <ul className="space-y-1">
        {options.map((option) => {
          const isActive = selected.includes(option.slug);
          return (
            <li key={option.id}>
              <Link
                href={href(option.slug)}
                // Announces state to assistive tech, since these are links standing
                // in for checkboxes.
                aria-pressed={isActive}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                  isActive
                    ? "bg-signal-100 font-semibold text-signal-700"
                    : "hover:bg-concrete-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-block size-3.5 shrink-0 rounded-sm border ${
                      isActive
                        ? "border-signal-600 bg-signal-600"
                        : "border-concrete-400 bg-white"
                    }`}
                  />
                  {option.name}
                </span>
                <span className="text-xs text-concrete-600">{option.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/**
 * Price is a GET form rather than links: the value is continuous, so there is no
 * finite set of URLs to enumerate. Hidden inputs carry the other active filters
 * through, because a plain form submission replaces the whole query string.
 */
function PriceFilter({
  basePath,
  query,
  facets,
}: {
  basePath: string;
  query: ProductQuery;
  facets: Facets;
}) {
  if (!facets.priceRange.min || !facets.priceRange.max) return null;

  const carried: [string, string][] = [];
  if (query.q) carried.push(["q", query.q]);
  if (query.sort !== "relevance") carried.push(["sort", query.sort]);
  for (const slug of query.brandSlugs ?? []) carried.push(["brand", slug]);
  for (const slug of query.roomSlugs ?? []) carried.push(["room", slug]);
  for (const slug of query.stageSlugs ?? []) carried.push(["stage", slug]);
  for (const unit of query.units ?? []) carried.push(["unit", unit]);

  return (
    <form action={basePath} method="get">
      {carried.map(([name, value], index) => (
        <input
          key={`${name}-${index}`}
          type="hidden"
          name={name}
          value={value}
        />
      ))}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min">
            Minimum price
          </label>
          <input
            id="filter-min"
            name="min"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={query.minPrice ?? ""}
            placeholder={Math.floor(Number(facets.priceRange.min)).toString()}
            className="w-full rounded border border-concrete-200 bg-white px-2 py-1 text-sm"
          />
          <span aria-hidden="true" className="text-concrete-400">
            –
          </span>
          <label className="sr-only" htmlFor="filter-max">
            Maximum price
          </label>
          <input
            id="filter-max"
            name="max"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={query.maxPrice ?? ""}
            placeholder={Math.ceil(Number(facets.priceRange.max)).toString()}
            className="w-full rounded border border-concrete-200 bg-white px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded border border-concrete-400 px-3 py-1.5 text-sm font-medium hover:bg-concrete-100"
        >
          Apply price
        </button>
      </fieldset>
    </form>
  );
}
