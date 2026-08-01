import { productQuery } from "@buildanta/api/client";
import type { ProductQuery } from "@buildanta/api/client";

/**
 * The URL is the single source of truth for search and filter state.
 *
 * Nothing about a result page lives in React state, so every filtered view is
 * linkable, shareable, back-button-correct and server-renderable. The live
 * prototype's stage and room tiles all pointed at one URL with no slug, which made
 * a filtered view impossible to link to at all.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

/** Repeated params arrive as an array; a single one as a string. */
function many(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const list = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function int(value: string | string[] | undefined): number | undefined {
  const raw = single(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

/**
 * Parses URL params into a validated query.
 *
 * A hand-typed or stale URL must never crash the page, so anything invalid falls
 * back to a default rather than throwing — but it is still validated against the
 * same schema the API enforces, so a filter the server would reject never gets sent.
 */
export function parseProductSearchParams(
  params: RawSearchParams,
  overrides: Partial<ProductQuery> = {},
): ProductQuery {
  const candidate = {
    q: single(params["q"]),
    categorySlug: single(params["category"]),
    brandSlugs: many(params["brand"]),
    roomSlugs: many(params["room"]),
    stageSlugs: many(params["stage"]),
    units: many(params["unit"]),
    minPrice: single(params["min"]),
    maxPrice: single(params["max"]),
    sort: single(params["sort"]),
    page: int(params["page"]) ?? 1,
    limit: int(params["limit"]) ?? 24,
    ...overrides,
  };

  const parsed = productQuery.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Drop only the fields that failed, keeping the rest of the URL meaningful.
  const invalid = new Set(parsed.error.issues.map((issue) => issue.path[0]));
  const cleaned = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => !invalid.has(key)),
  );

  return productQuery.parse({ ...cleaned, ...overrides });
}

/** Builds a URL preserving current filters with specific values replaced. */
export function buildProductUrl(
  basePath: string,
  current: ProductQuery,
  changes: Partial<
    Record<string, string | string[] | number | undefined>
  > = {},
): string {
  const params = new URLSearchParams();

  const merged: Record<string, string | string[] | number | undefined> = {
    q: current.q,
    category: current.categorySlug,
    brand: current.brandSlugs,
    room: current.roomSlugs,
    stage: current.stageSlugs,
    unit: current.units,
    min: current.minPrice,
    max: current.maxPrice,
    // Omitted when default, so the common URL stays clean.
    sort: current.sort === "relevance" ? undefined : current.sort,
    page: current.page === 1 ? undefined : current.page,
    ...changes,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Toggles one value in a multi-select filter, resetting pagination. */
export function toggleFilterUrl(
  basePath: string,
  current: ProductQuery,
  key: "brand" | "room" | "stage" | "unit",
  value: string,
): string {
  const listByKey = {
    brand: current.brandSlugs,
    room: current.roomSlugs,
    stage: current.stageSlugs,
    unit: current.units,
  } as const;

  const existing = listByKey[key] ?? [];
  const next = existing.includes(value)
    ? existing.filter((entry) => entry !== value)
    : [...existing, value];

  // Any filter change invalidates the page number: page 4 of the old result set is
  // usually empty in the new one.
  return buildProductUrl(basePath, current, {
    [key]: next.length ? next : undefined,
    page: undefined,
  });
}
