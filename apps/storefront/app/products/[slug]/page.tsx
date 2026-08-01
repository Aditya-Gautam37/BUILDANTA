import { formatMoney, formatUnit } from "@buildanta/api/client";
import type { VariantDto } from "@buildanta/api/client";
import { TRPCClientError } from "@trpc/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToQuote } from "@/components/add-to-quote";
import { ProductCard } from "@/components/product-card";
import { api } from "@/lib/api";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * A missing product must render the 404 page, not a 500. tRPC signals it with a
 * NOT_FOUND code, translated here — the only place that needs to distinguish "no
 * such product" from "the API is broken".
 */
async function loadProduct(slug: string) {
  try {
    return await api.catalog.products.bySlug.query({ slug });
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
    const product = await api.catalog.products.bySlug.query({ slug });
    return {
      title: product.name,
      description: product.summary ?? undefined,
    };
  } catch {
    // Metadata generation must never be what breaks the page render.
    return { title: "Product" };
  }
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const product = await loadProduct(slug);
  const related = await api.catalog.products.related.query({ slug, limit: 4 });

  const requestedSku = Array.isArray(search["variant"])
    ? search["variant"][0]
    : search["variant"];

  // Falls back to the default variant when the URL names one that does not exist,
  // so a stale link still renders a usable page.
  const selected =
    product.variants.find((variant) => variant.sku === requestedSku) ??
    product.variants.find((variant) => variant.isDefault) ??
    product.variants[0];

  const gallery = selected
    ? product.images.filter(
        (image) => image.variantId === null || image.variantId === selected.id,
      )
    : product.images;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-concrete-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-signal-700">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/categories/${product.category.slug}`}
              className="hover:text-signal-700"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-concrete-900">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-lg border border-concrete-200 bg-white">
            {gallery[0] ? (
              <Image
                src={gallery[0].url}
                alt={gallery[0].altText ?? product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-concrete-400">
                No image yet
              </div>
            )}
          </div>

          {gallery.length > 1 ? (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {gallery.slice(0, 5).map((image) => (
                <li
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded border border-concrete-200 bg-white"
                >
                  <Image
                    src={image.url}
                    alt={image.altText ?? ""}
                    fill
                    sizes="20vw"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          {product.brand ? (
            <Link
              href={`/products?brand=${product.brand.slug}`}
              className="text-sm font-semibold uppercase tracking-wide text-signal-700 hover:underline"
            >
              {product.brand.name}
            </Link>
          ) : null}

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {product.name}
          </h1>

          {product.summary ? (
            <p className="mt-3 text-lg text-concrete-600">{product.summary}</p>
          ) : null}

          {selected ? (
            <div className="mt-6 rounded-lg border border-concrete-200 bg-white p-5">
              <p className="text-3xl font-bold">
                {formatMoney(selected.price, selected.currency)}
                <span className="ml-1 text-base font-normal text-concrete-600">
                  per {formatUnit(selected.unit, "long")}
                </span>
              </p>

              <dl className="mt-2 text-sm text-concrete-600">
                <div className="flex gap-2">
                  <dt className="font-medium">SKU</dt>
                  <dd>{selected.sku}</dd>
                </div>
                {selected.packSize ? (
                  <div className="flex gap-2">
                    <dt className="font-medium">Pack</dt>
                    <dd>
                      {selected.packSize} × {formatUnit(selected.unit, "long")}
                    </dd>
                  </div>
                ) : null}
                {selected.weightKg ? (
                  <div className="flex gap-2">
                    <dt className="font-medium">Weight</dt>
                    <dd>{selected.weightKg} kg</dd>
                  </div>
                ) : null}
              </dl>

              <AddToQuote variantId={selected.id} unit={selected.unit} />

              <p className="mt-3 text-xs text-concrete-600">
                Listed price is indicative and excludes delivery and taxes. We
                confirm pricing when we quote.
              </p>
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-concrete-200 bg-white p-5 text-concrete-600">
              Pricing for this product is not available yet.
            </p>
          )}

          {product.variants.length > 1 && selected ? (
            <VariantPicker
              slug={product.slug}
              variants={product.variants}
              selectedId={selected.id}
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {product.stages.map((stage) => (
              <Link
                key={stage.id}
                href={`/stages/${stage.slug}`}
                className="rounded-full bg-steel-600 px-3 py-1 text-xs font-medium text-white hover:bg-steel-700"
              >
                {stage.name}
              </Link>
            ))}
            {product.rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.slug}`}
                className="rounded-full border border-concrete-400 px-3 py-1 text-xs font-medium hover:bg-concrete-100"
              >
                {room.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {product.description ? (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-xl font-bold">Description</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-concrete-800">
            {product.description}
          </p>
        </section>
      ) : null}

      {Object.keys(product.specifications).length > 0 ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-bold">Specifications</h2>
          <dl className="mt-3 divide-y divide-concrete-200 rounded-lg border border-concrete-200 bg-white">
            {Object.entries(product.specifications).map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-2 gap-4 px-4 py-3 text-sm"
              >
                <dt className="font-medium text-concrete-600">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {product.variants.length > 1 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold">All options</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-concrete-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-concrete-100 text-left">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Option
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    SKU
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Sold by
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-200">
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/products/${product.slug}?variant=${variant.sku}`}
                        className="font-medium hover:text-signal-700"
                      >
                        {variant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-concrete-600">
                      {variant.sku}
                    </td>
                    <td className="px-4 py-2 text-concrete-600">
                      {formatUnit(variant.unit, "long")}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatMoney(variant.price, variant.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-xl font-bold">More in {product.category.name}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id} className="flex">
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Variant selection is a set of links carrying `?variant=<sku>`, so the choice lives
 * in the URL and the page stays a server component. It also means a specific variant
 * can be linked to directly, which a stateful dropdown cannot offer.
 */
function VariantPicker({
  slug,
  variants,
  selectedId,
}: {
  slug: string;
  variants: VariantDto[];
  selectedId: string;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-concrete-600">
        Options
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId;
          return (
            <li key={variant.id}>
              <Link
                href={`/products/${slug}?variant=${variant.sku}`}
                aria-current={isSelected ? "true" : undefined}
                className={`block rounded-md border px-3 py-2 text-sm ${
                  isSelected
                    ? "border-signal-600 bg-signal-50 font-semibold text-signal-700"
                    : "border-concrete-200 bg-white hover:border-concrete-400"
                }`}
              >
                <span className="block">{variant.name}</span>
                <span className="block text-xs text-concrete-600">
                  {formatMoney(variant.price, variant.currency)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
