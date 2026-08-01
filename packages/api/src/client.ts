/**
 * Browser- and edge-safe surface of the API package.
 *
 * Deliberately imports no server module at runtime. `@buildanta/api` pulls in
 * Prisma, sharp and the filesystem; if a Next.js client component reached for that,
 * the bundle would either balloon or fail to build. The web apps import this
 * instead and get the same types — the `export type` re-exports below are erased at
 * compile time, so nothing from the router reaches the bundle.
 */

export type { AppRouter } from "./root.js";

export type {
  ImageDto,
  ProductDetailDto,
  ProductListDto,
  QuoteDetailDto,
  QuoteItemDto,
  TaxonomyRefDto,
  VariantDto,
} from "./serializers.js";

export type { CategoryNode } from "./routers/taxonomy.js";

export type { ProductQuery } from "./schemas.js";

// Input schemas are re-exported as values so forms validate with the exact rules
// the server enforces, rather than an approximation of them. These pull in only
// zod.
export {
  brandInput,
  categoryInput,
  changePasswordInput,
  constructionStageInput,
  imageMetadataInput,
  loginInput,
  productInput,
  productQuery,
  productStatus,
  productVariantInput,
  quoteRequestInput,
  quoteRequestItemInput,
  quoteStatus,
  roomInput,
  salesUnit,
  supplierInput,
} from "./schemas.js";

export {
  formatMoney,
  formatPriceRange,
  formatQuantity,
  formatUnit,
} from "./format.js";
