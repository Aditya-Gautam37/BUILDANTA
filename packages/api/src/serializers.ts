import { Prisma, decimalToString, measurementToString } from "@buildanta/db";

/**
 * Prisma rows are not wire-safe: `Decimal` serializes to `{}` over JSON and loses
 * precision through `Number`. Every read path goes through a function in this
 * file, so a Decimal can never leak to a client. The exported DTO types are also
 * what the web apps consume, which is why prices are `string` there.
 */

// --- selections -----------------------------------------------------------

export const imageSelect = {
  id: true,
  url: true,
  altText: true,
  width: true,
  height: true,
  sortOrder: true,
  isPrimary: true,
  variantId: true,
} satisfies Prisma.ProductImageSelect;

export const variantSelect = {
  id: true,
  sku: true,
  name: true,
  attributes: true,
  price: true,
  currency: true,
  unit: true,
  packSize: true,
  weightKg: true,
  lengthMm: true,
  widthMm: true,
  heightMm: true,
  isDefault: true,
  isActive: true,
  supplier: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductVariantSelect;

export const taxonomyRefSelect = {
  id: true,
  slug: true,
  name: true,
} satisfies Prisma.CategorySelect;

/**
 * List rows read the denormalized price columns instead of joining every variant.
 * A 24-product grid was otherwise loading several hundred variant rows to render
 * one "from" price each.
 */
export const productListSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  status: true,
  minPrice: true,
  maxPrice: true,
  priceCurrency: true,
  activeVariantCount: true,
  category: { select: taxonomyRefSelect },
  brand: { select: taxonomyRefSelect },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 1,
    select: imageSelect,
  },
} satisfies Prisma.ProductSelect;

export const productDetailSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  status: true,
  minPrice: true,
  maxPrice: true,
  priceCurrency: true,
  activeVariantCount: true,
  description: true,
  specifications: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: taxonomyRefSelect },
  brand: { select: taxonomyRefSelect },
  rooms: { select: taxonomyRefSelect, orderBy: { sortOrder: "asc" } },
  stages: { select: taxonomyRefSelect, orderBy: { sortOrder: "asc" } },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { price: "asc" }],
    select: variantSelect,
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: imageSelect,
  },
} satisfies Prisma.ProductSelect;

/** Admin detail additionally exposes inactive variants. */
export const adminProductDetailSelect = {
  ...productDetailSelect,
  variants: {
    orderBy: [{ isDefault: "desc" }, { price: "asc" }],
    select: variantSelect,
  },
} satisfies Prisma.ProductSelect;

export const quoteItemSelect = {
  id: true,
  variantId: true,
  productName: true,
  variantName: true,
  sku: true,
  unit: true,
  unitPrice: true,
  currency: true,
  quantity: true,
  note: true,
} satisfies Prisma.QuoteRequestItemSelect;

export const quoteDetailSelect = {
  id: true,
  reference: true,
  status: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  companyName: true,
  projectName: true,
  deliveryPincode: true,
  message: true,
  requiredBy: true,
  internalNotes: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  items: { select: quoteItemSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.QuoteRequestSelect;

// --- payload types --------------------------------------------------------

type ImageRow = Prisma.ProductImageGetPayload<{ select: typeof imageSelect }>;
type VariantRow = Prisma.ProductVariantGetPayload<{
  select: typeof variantSelect;
}>;
type ProductListRow = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;
type ProductDetailRow = Prisma.ProductGetPayload<{
  select: typeof adminProductDetailSelect;
}>;
type QuoteItemRow = Prisma.QuoteRequestItemGetPayload<{
  select: typeof quoteItemSelect;
}>;
type QuoteDetailRow = Prisma.QuoteRequestGetPayload<{
  select: typeof quoteDetailSelect;
}>;

// --- DTOs -----------------------------------------------------------------

export interface ImageDto {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId: string | null;
}

export interface VariantDto {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  /** Decimal string, e.g. "1250.00". Format for display with `formatMoney`. */
  price: string;
  currency: string;
  unit: string;
  packSize: string | null;
  weightKg: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  isDefault: boolean;
  isActive: boolean;
  supplier: { id: string; name: string; slug: string } | null;
}

export interface TaxonomyRefDto {
  id: string;
  slug: string;
  name: string;
}

export interface ProductListDto {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  status: string;
  category: TaxonomyRefDto;
  brand: TaxonomyRefDto | null;
  /** Lowest active variant price, for the "from" label. Null if no variant. */
  fromPrice: string | null;
  highestPrice: string | null;
  currency: string | null;
  variantCount: number;
  primaryImage: ImageDto | null;
}

export interface ProductDetailDto extends Omit<ProductListDto, "primaryImage"> {
  description: string | null;
  specifications: Record<string, string>;
  rooms: TaxonomyRefDto[];
  stages: TaxonomyRefDto[];
  variants: VariantDto[];
  images: ImageDto[];
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface QuoteItemDto {
  id: string;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  unit: string;
  unitPrice: string;
  currency: string;
  quantity: string;
  note: string | null;
  /** unitPrice × quantity, computed with Decimal then stringified. */
  lineTotal: string;
}

export interface QuoteDetailDto {
  id: string;
  reference: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  companyName: string | null;
  projectName: string | null;
  deliveryPincode: string | null;
  message: string | null;
  requiredBy: Date | null;
  internalNotes: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: { id: string; name: string; email: string } | null;
  items: QuoteItemDto[];
  /**
   * Sum of the line totals at the prices shown when the request was submitted.
   * An indicative figure, explicitly not a quoted price.
   */
  indicativeTotal: string;
  currency: string | null;
}

// --- mappers --------------------------------------------------------------

export function serializeImage(row: ImageRow): ImageDto {
  return {
    id: row.id,
    url: row.url,
    altText: row.altText,
    width: row.width,
    height: row.height,
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
    variantId: row.variantId,
  };
}

export function serializeVariant(row: VariantRow): VariantDto {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    attributes: asStringRecord(row.attributes),
    price: decimalToString(row.price),
    // `Char(3)` is blank-padded by Postgres, so an untrimmed value reads "INR ".
    currency: row.currency.trim(),
    unit: row.unit,
    packSize: measurementToString(row.packSize),
    weightKg: measurementToString(row.weightKg),
    lengthMm: row.lengthMm,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    isDefault: row.isDefault,
    isActive: row.isActive,
    supplier: row.supplier,
  };
}

export function serializeProductListItem(row: ProductListRow): ProductListDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    status: row.status,
    category: row.category,
    brand: row.brand,
    fromPrice: decimalToString(row.minPrice),
    highestPrice: decimalToString(row.maxPrice),
    currency: row.priceCurrency?.trim() ?? null,
    variantCount: row.activeVariantCount,
    primaryImage: row.images[0] ? serializeImage(row.images[0]) : null,
  };
}

export function serializeProductDetail(row: ProductDetailRow): ProductDetailDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    status: row.status,
    category: row.category,
    brand: row.brand,
    fromPrice: decimalToString(row.minPrice),
    highestPrice: decimalToString(row.maxPrice),
    currency: row.priceCurrency?.trim() ?? null,
    variantCount: row.activeVariantCount,
    description: row.description,
    specifications: asStringRecord(row.specifications),
    rooms: row.rooms,
    stages: row.stages,
    variants: row.variants.map(serializeVariant),
    images: row.images.map(serializeImage),
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeQuoteItem(row: QuoteItemRow): QuoteItemDto {
  // Multiplied as Decimal, not Number: quantities carry three decimals and
  // tonne prices five figures, which is exactly where float drift shows up.
  const lineTotal = row.unitPrice.mul(row.quantity);

  return {
    id: row.id,
    variantId: row.variantId,
    productName: row.productName,
    variantName: row.variantName,
    sku: row.sku,
    unit: row.unit,
    unitPrice: decimalToString(row.unitPrice),
    currency: row.currency.trim(),
    quantity: row.quantity.toString(),
    note: row.note,
    lineTotal: lineTotal.toFixed(2),
  };
}

export function serializeQuoteDetail(row: QuoteDetailRow): QuoteDetailDto {
  const items = row.items.map(serializeQuoteItem);

  const total = row.items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    companyName: row.companyName,
    projectName: row.projectName,
    deliveryPincode: row.deliveryPincode,
    message: row.message,
    requiredBy: row.requiredBy,
    internalNotes: row.internalNotes,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignedTo: row.assignedTo,
    items,
    indicativeTotal: total.toFixed(2),
    currency: items[0]?.currency ?? null,
  };
}

/**
 * `Json` columns are `unknown` as far as the type system is concerned — the
 * database will return whatever an older migration or a manual edit put there.
 * Coerce defensively instead of casting.
 */
function asStringRecord(value: Prisma.JsonValue): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    result[key] = typeof raw === "string" ? raw : String(raw);
  }
  return result;
}
