import { TRPCClientError } from "@trpc/client";
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

async function loadCategory(slug: string) {
  try {
    return await api.catalog.taxonomy.categoryBySlug.query({ slug });
  } catch (error) {
    if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const category = await api.catalog.taxonomy.categoryBySlug.query({ slug });
    return {
      title: category.name,
      description: category.description ?? undefined,
    };
  } catch {
    return { title: "Category" };
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const category = await loadCategory(slug);

  // The route pins the category, so a `category` param in the URL is overridden
  // rather than allowed to contradict the page it is on.
  const query = parseProductSearchParams(search, { categorySlug: slug });

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
            <Link href="/categories" className="hover:text-signal-700">
              Categories
            </Link>
          </li>
          {category.parent ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/categories/${category.parent.slug}`}
                  className="hover:text-signal-700"
                >
                  {category.parent.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="text-concrete-900">{category.name}</li>
        </ol>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
        {category.description ? (
          <p className="mt-2 max-w-2xl text-concrete-600">
            {category.description}
          </p>
        ) : null}

        {category.children.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/categories/${child.slug}`}
                  className="inline-block rounded-full border border-concrete-400 bg-white px-3 py-1.5 text-sm font-medium hover:border-signal-500 hover:text-signal-700"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <CatalogResults basePath={`/categories/${slug}`} query={query} />
    </div>
  );
}
