import type { Metadata } from "next";
import Link from "next/link";

import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Shop by build stage",
  description:
    "Construction materials grouped by the phase of the build, in the order the work happens.",
};

export default async function StagesPage() {
  const stages = await api.catalog.taxonomy.stages.query();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Shop by build stage</h1>
      <p className="mt-1 max-w-2xl text-concrete-600">
        Ten stages, in the order the work happens on site. Each one is its own
        page, so you can send someone a link to exactly what they need.
      </p>

      {/* An ordered list, because the order is meaningful data (`sortOrder` is the
          build chronology), not just a layout choice. */}
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage, index) => (
          <li key={stage.id}>
            <Link
              href={`/stages/${stage.slug}`}
              className="flex h-full flex-col rounded-lg border border-concrete-200 bg-white p-5 hover:border-signal-500 hover:shadow-sm"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-signal-700">
                Stage {index + 1} of {stages.length}
              </span>
              <span className="mt-1 text-lg font-semibold">{stage.name}</span>
              {stage.description ? (
                <span className="mt-1 text-sm text-concrete-600">
                  {stage.description}
                </span>
              ) : null}
              <span className="mt-auto pt-3 text-sm text-concrete-600">
                {stage.productCount} product
                {stage.productCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
