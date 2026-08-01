import { z } from "zod";

/**
 * Input shapes shared by the storefront, the admin app and the seed script.
 * Defined once here so validation cannot drift between caller and resolver.
 */

export const uuid = z.string().uuid();

/**
 * URL-safe slug.
 *
 * The single-hyphen rule is enforced, not just preferred. The live prototype's
 * slugs read `tiles--flooring` and `sanitaryware--bathware`, because "&" was
 * stripped without collapsing the separator; this schema rejects that shape
 * outright rather than trusting whatever generated the value.
 */
export const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

/** A decimal money amount as a string, e.g. "1250.00". Never a float. */
export const money = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 1250.00.");

/** A non-negative measurement with up to three decimals, e.g. "50.000". */
export const measurement = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, "Enter a number like 50.000");

/** A quantity on a quote line. Must be greater than zero. */
export const quantity = measurement.refine(
  (value) => Number(value) > 0,
  "Enter a quantity greater than zero.",
);

export const currencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Use a three-letter ISO 4217 code, e.g. INR.");

export const salesUnit = z.enum([
  "PIECE",
  "BAG",
  "BOX",
  "BUNDLE",
  "ROLL",
  "SHEET",
  "METRE",
  "SQUARE_METRE",
  "CUBIC_METRE",
  "LITRE",
  "KILOGRAM",
  "TONNE",
]);

export const productStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const quoteStatus = z.enum([
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "WON",
  "LOST",
  "CLOSED",
]);

/**
 * Page-based paging with a hard ceiling, capped server-side so a caller cannot
 * ask for the entire products table in one request.
 */
export const pagination = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(24),
});

export const productSort = z
  .enum(["relevance", "newest", "price-asc", "price-desc", "name-asc"])
  .default("relevance");

/** Storefront search and filter input. */
export const productQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  categorySlug: slug.optional(),
  brandSlugs: z.array(slug).max(20).optional(),
  roomSlugs: z.array(slug).max(20).optional(),
  stageSlugs: z.array(slug).max(20).optional(),
  minPrice: money.optional(),
  maxPrice: money.optional(),
  units: z.array(salesUnit).max(12).optional(),
  sort: productSort,
});

export type ProductQuery = z.infer<typeof productQuery>;

/** Admin list input: adds status filtering, which the storefront must not have. */
export const adminProductQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  status: productStatus.optional(),
  categoryId: uuid.optional(),
  brandId: uuid.optional(),
  sort: z.enum(["newest", "name-asc", "updated"]).default("updated"),
});

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

// --- taxonomy -------------------------------------------------------------

export const categoryInput = z.object({
  slug,
  name: z.string().trim().min(1).max(160),
  description: nullableText(2000),
  parentId: uuid.nullish().transform((value) => value ?? null),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const brandInput = z.object({
  slug,
  name: z.string().trim().min(1).max(160),
  description: nullableText(2000),
  logoUrl: z
    .string()
    .url()
    .max(2000)
    .nullish()
    .transform((value) => value ?? null),
  websiteUrl: z
    .string()
    .url()
    .max(2000)
    .nullish()
    .transform((value) => value ?? null),
  isActive: z.boolean().default(true),
});

export const roomInput = z.object({
  slug,
  name: z.string().trim().min(1).max(160),
  description: nullableText(2000),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

/**
 * Identical to `roomInput` today, but `sortOrder` means something different: for a
 * stage it is the chronological position in a build, which the storefront's
 * stage-to-stage navigation depends on. Kept as its own export so the two can
 * diverge without a rename rippling through both.
 */
export const constructionStageInput = roomInput;

export const supplierInput = z.object({
  slug,
  name: z.string().trim().min(1).max(200),
  contactName: nullableText(160),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullish()
    .transform((value) => value ?? null),
  contactPhone: nullableText(40),
  addressLine1: nullableText(200),
  addressLine2: nullableText(200),
  city: nullableText(120),
  region: nullableText(120),
  postalCode: nullableText(40),
  country: nullableText(120),
  notes: nullableText(4000),
  isActive: z.boolean().default(true),
});

// --- products -------------------------------------------------------------

export const productInput = z.object({
  slug,
  name: z.string().trim().min(1).max(240),
  summary: nullableText(400),
  description: nullableText(20_000),
  status: productStatus.default("DRAFT"),
  categoryId: uuid,
  brandId: uuid.nullish().transform((value) => value ?? null),
  /** Flat label/value pairs; nesting is not supported by the product page. */
  specifications: z.record(z.string().max(2000)).default({}),
  roomIds: z.array(uuid).max(50).default([]),
  stageIds: z.array(uuid).max(50).default([]),
});

export const productVariantInput = z.object({
  productId: uuid,
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
      "Use letters, numbers and . _ / - only.",
    ),
  name: z.string().trim().min(1).max(240),
  attributes: z.record(z.string().max(500)).default({}),
  price: money,
  currency: currencyCode.optional(),
  unit: salesUnit.default("PIECE"),
  packSize: measurement.nullish().transform((value) => value ?? null),
  weightKg: measurement.nullish().transform((value) => value ?? null),
  lengthMm: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullish()
    .transform((value) => value ?? null),
  widthMm: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullish()
    .transform((value) => value ?? null),
  heightMm: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullish()
    .transform((value) => value ?? null),
  supplierId: uuid.nullish().transform((value) => value ?? null),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const imageMetadataInput = z.object({
  id: uuid,
  altText: nullableText(300),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  variantId: uuid.nullish().transform((value) => value ?? null),
});

// --- quote requests -------------------------------------------------------

/**
 * A single line of a bulk quote request.
 *
 * Only the variant and a quantity are accepted from the client. Price, SKU, unit
 * and product name are read from the database at submission time — trusting a
 * client-supplied price would let anyone request a quote at a price of their
 * choosing and then argue it was displayed.
 */
export const quoteRequestItemInput = z.object({
  variantId: uuid,
  quantity,
  note: nullableText(500),
});

export const quoteRequestInput = z.object({
  contactName: z.string().trim().min(1).max(160),
  contactEmail: z.string().trim().toLowerCase().email().max(320),
  contactPhone: nullableText(40),
  companyName: nullableText(200),
  projectName: nullableText(200),
  /** Six digits, as used across India. Optional — not every enquiry has a site. */
  deliveryPincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a six-digit pincode.")
    .nullish()
    .transform((value) => value ?? null),
  message: nullableText(4000),
  /**
   * A date string rather than a Date: it arrives from an `<input type="date">`,
   * and parsing it here keeps timezone interpretation in one place.
   */
  requiredBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
    .nullish()
    .transform((value) => value ?? null),
  items: z
    .array(quoteRequestItemInput)
    .min(1, "Add at least one product to request a quote.")
    .max(50, "A single request can cover at most 50 products."),
});

export const adminQuoteQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  status: quoteStatus.optional(),
  sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
});

export const quoteStatusUpdateInput = z.object({
  id: uuid,
  status: quoteStatus,
  internalNotes: nullableText(4000),
});

// --- auth -----------------------------------------------------------------

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  /**
   * Not length-validated beyond an upper bound: a minimum here would let an
   * attacker distinguish "too short" from "wrong", and the real policy is
   * enforced when a password is *set*.
   */
  password: z.string().min(1).max(200),
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
