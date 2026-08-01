import type { Prisma } from "@buildanta/db";

/**
 * Recomputes `Product.minPrice`, `maxPrice`, `priceCurrency` and
 * `activeVariantCount` from that product's active variants.
 *
 * The single writer of those columns. Call it inside the same transaction as any
 * variant insert, update or delete — the columns exist so the storefront can sort
 * and filter on price, and a stale value there is a visibly wrong catalog.
 *
 * Takes a transaction client rather than the global one so a caller cannot commit
 * a variant change without the matching recompute.
 */
export async function recomputeProductPricing(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const [aggregate, cheapest] = await Promise.all([
    tx.productVariant.aggregate({
      where: { productId, isActive: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    }),
    // Currency comes from the cheapest active variant, matching the "from" price
    // the storefront shows. Release 1 assumes one currency per product; if that
    // stops being true, this is the line to revisit.
    tx.productVariant.findFirst({
      where: { productId, isActive: true },
      orderBy: { price: "asc" },
      select: { currency: true },
    }),
  ]);

  await tx.product.update({
    where: { id: productId },
    data: {
      minPrice: aggregate._min.price,
      maxPrice: aggregate._max.price,
      priceCurrency: cheapest?.currency ?? null,
      activeVariantCount: aggregate._count._all,
    },
  });
}
