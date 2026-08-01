import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogResults } from "@/components/catalog-results";
import { api } from "@/lib/api";
import { parseProductSearchParams } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const stages = await api.catalog.taxonomy.stages.query();
  const stage = stages.find((entry) => entry.slug === slug);
  return {
    title: stage ? `${stage.name} materials` : "Build stage",
    description: stage?.description ?? undefined,
  };
}

/**
 * A real, addressable page per build stage.
 *
 * On the live prototype all ten stage tiles pointed at `/by-stage` with no slug, so
 * no stage view could be linked, bookmarked or shared. Here the slug is the route.
 */
export default async function StagePage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);

  // Stages are a short, ordered list, so the whole set is fetched: it gives the
  // position and the neighbours for free, which a single-stage endpoint would not.
  const stages = await api.catalog.taxonomy.stages.query();
  const index = stages.findIndex((entry) => entry.slug === slug);
  if (index === -1) notFound();

  const stage = stages[index]!;
  const previous = stages[index - 1];
  const next = stages[index + 1];

  const query = parseProductSearchParams(search, { stageSlugs: [slug] });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-concrete-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-signal-700">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/stages" className="hover:text-signal-700">
              Build stages
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-concrete-900">{stage.name}</li>
        </ol>
      </nav>

      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-signal-700">
          Stage {index + 1} of {stages.length}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{stage.name}</h1>
        {stage.description ? (
          <p className="mt-2 max-w-2xl text-concrete-600">{stage.description}</p>
        ) : null}

        {/* Stages are ordered by build chronology, so the neighbours are simply
            adjacent — which makes "what comes next" navigation free. */}
        <nav
          className="mt-4 flex flex-wrap gap-4 text-sm"
          aria-label="Adjacent build stages"
        >
          {previous ? (
            <Link
              href={`/stages/${previous.slug}`}
              className="text-signal-700 hover:underline"
            >
              ← Before this: {previous.name}
            </Link>
          ) : null}
          {next ? (
            <Link
              href={`/stages/${next.slug}`}
              className="text-signal-700 hover:underline"
            >
              Next up: {next.name} →
            </Link>
          ) : null}
        </nav>
      </header>

      <CatalogResults
        basePath={`/stages/${slug}`}
        query={query}
        hide={["stage"]}
      />
    </div>
  );
}
