import type { Metadata } from "next";
import Link from "next/link";

import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "All categories",
  description: "Every Buildanta product category and subcategory.",
};

export default async function CategoriesPage() {
  const categories = await api.catalog.taxonomy.categoryTree.query();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">All categories</h1>
      <p className="mt-1 text-concrete-600">
        {categories.length} top-level categories.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <section
            key={category.id}
            className="rounded-lg border border-concrete-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold">
              <Link
                href={`/categories/${category.slug}`}
                className="hover:text-signal-700"
              >
                {category.name}
              </Link>
            </h2>
            {category.description ? (
              <p className="mt-1 text-sm text-concrete-600">
                {category.description}
              </p>
            ) : null}

            {category.children.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/categories/${child.slug}`}
                      className="text-concrete-600 hover:text-signal-700"
                    >
                      {child.name}
                      <span className="ml-1 text-concrete-400">
                        ({child.productCount})
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
