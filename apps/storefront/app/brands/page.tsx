import type { Metadata } from "next";
import Link from "next/link";

import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Brands",
  description: "Every brand stocked on Buildanta.",
};

export default async function BrandsPage() {
  const brands = await api.catalog.taxonomy.brands.query();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
      <p className="mt-1 text-concrete-600">{brands.length} brands stocked.</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id}>
            <Link
              href={`/products?brand=${brand.slug}`}
              className="flex h-full flex-col rounded-lg border border-concrete-200 bg-white p-5 hover:border-signal-500 hover:shadow-sm"
            >
              <span className="text-lg font-semibold">{brand.name}</span>
              {brand.description ? (
                <span className="mt-1 line-clamp-2 text-sm text-concrete-600">
                  {brand.description}
                </span>
              ) : null}
              <span className="mt-auto pt-3 text-sm text-concrete-600">
                {brand.productCount} product
                {brand.productCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
