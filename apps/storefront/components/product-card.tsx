import { formatPriceRange } from "@buildanta/api/client";
import type { ProductListDto } from "@buildanta/api/client";
import Image from "next/image";
import Link from "next/link";

export function ProductCard({ product }: { product: ProductListDto }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-concrete-200 bg-white transition hover:border-signal-500 hover:shadow-md"
    >
      <div className="relative aspect-4/3 bg-concrete-100">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            // Falls back to the product name rather than an empty string: a
            // decorative alt would be wrong, the image *is* the product.
            alt={product.primaryImage.altText ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-concrete-400">
            No image yet
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.brand ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-concrete-600">
            {product.brand.name}
          </p>
        ) : null}

        <h3 className="mt-1 font-semibold leading-snug group-hover:text-signal-700">
          {product.name}
        </h3>

        {product.summary ? (
          <p className="mt-1 line-clamp-2 text-sm text-concrete-600">
            {product.summary}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
          <p className="text-lg font-bold">
            {formatPriceRange(
              product.fromPrice,
              product.highestPrice,
              product.currency,
            )}
          </p>
          {product.variantCount > 1 ? (
            <p className="text-xs text-concrete-600">
              {product.variantCount} options
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
