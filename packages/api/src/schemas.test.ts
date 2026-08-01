import { describe, expect, it } from "vitest";

import {
  categoryInput,
  money,
  productQuery,
  quoteRequestInput,
  quoteRequestItemInput,
  slug,
} from "./schemas.js";

describe("slug", () => {
  it("accepts a well-formed slug", () => {
    expect(slug.safeParse("tiles-flooring").success).toBe(true);
    expect(slug.safeParse("opc-53-grade-cement").success).toBe(true);
  });

  /**
   * Regression test for the exact defect found on the live buildanta.com: it
   * strips "&" without collapsing the separator, producing double hyphens like
   * `/categories/tiles--flooring` and `/categories/sanitaryware--bathware`. This
   * schema is the boundary that must reject that shape outright, regardless of
   * what generated the value.
   */
  it("rejects a double hyphen", () => {
    expect(slug.safeParse("tiles--flooring").success).toBe(false);
    expect(slug.safeParse("sanitaryware--bathware").success).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(slug.safeParse("Tiles-Flooring").success).toBe(false);
  });

  it("rejects a leading or trailing hyphen", () => {
    expect(slug.safeParse("-tiles-flooring").success).toBe(false);
    expect(slug.safeParse("tiles-flooring-").success).toBe(false);
  });

  it("rejects spaces and other separators", () => {
    expect(slug.safeParse("tiles flooring").success).toBe(false);
    expect(slug.safeParse("tiles_flooring").success).toBe(false);
    expect(slug.safeParse("tiles/flooring").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(slug.safeParse("").success).toBe(false);
  });
});

describe("money", () => {
  it("accepts a plain decimal amount", () => {
    expect(money.safeParse("435.00").success).toBe(true);
    expect(money.safeParse("435").success).toBe(true);
  });

  it("rejects more than two decimal places", () => {
    // Money is Decimal(12,2) in the schema; a third decimal place would be
    // silently truncated by Postgres rather than rejected, so it is caught here.
    expect(money.safeParse("435.001").success).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    expect(money.safeParse("free").success).toBe(false);
    expect(money.safeParse("₹435").success).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(money.safeParse("-1.00").success).toBe(false);
  });
});

describe("productQuery", () => {
  it("applies defaults for an empty query", () => {
    const parsed = productQuery.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(24);
    expect(parsed.sort).toBe("relevance");
  });

  it("caps the page size at 100", () => {
    expect(productQuery.safeParse({ limit: 500 }).success).toBe(false);
    expect(productQuery.safeParse({ limit: 100 }).success).toBe(true);
  });

  it("rejects a category slug shaped like the live site's broken ones", () => {
    expect(
      productQuery.safeParse({ categorySlug: "tiles--flooring" }).success,
    ).toBe(false);
  });

  it("rejects an unknown sort value rather than silently ignoring it", () => {
    expect(productQuery.safeParse({ sort: "cheapest-first" }).success).toBe(
      false,
    );
  });
});

describe("categoryInput", () => {
  it("defaults parentId to null rather than undefined", () => {
    // The Prisma update path relies on an explicit null to disconnect a parent;
    // undefined would be interpreted as "leave unchanged".
    const parsed = categoryInput.parse({ slug: "cement", name: "Cement" });
    expect(parsed.parentId).toBeNull();
  });
});

describe("quoteRequestItemInput", () => {
  it("requires a quantity greater than zero", () => {
    expect(
      quoteRequestItemInput.safeParse({
        variantId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: "0",
      }).success,
    ).toBe(false);
  });

  it("accepts a fractional quantity for measured units", () => {
    // A ready-mix concrete order in cubic metres, or steel in tonnes, is not a
    // whole number.
    expect(
      quoteRequestItemInput.safeParse({
        variantId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: "3.5",
      }).success,
    ).toBe(true);
  });
});

describe("quoteRequestInput", () => {
  const validVariantId = "550e8400-e29b-41d4-a716-446655440000";

  it("requires at least one item", () => {
    const result = quoteRequestInput.safeParse({
      contactName: "Anand Krishnan",
      contactEmail: "anand@example.com",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("caps a single request at 50 items", () => {
    const items = Array.from({ length: 51 }, () => ({
      variantId: validVariantId,
      quantity: "1",
    }));
    expect(
      quoteRequestInput.safeParse({
        contactName: "Anand Krishnan",
        contactEmail: "anand@example.com",
        items,
      }).success,
    ).toBe(false);
  });

  it("rejects a pincode that is not six digits", () => {
    const result = quoteRequestInput.safeParse({
      contactName: "Anand Krishnan",
      contactEmail: "anand@example.com",
      deliveryPincode: "12345",
      items: [{ variantId: validVariantId, quantity: "1" }],
    });
    expect(result.success).toBe(false);
  });

  it("lower-cases the contact email", () => {
    const result = quoteRequestInput.parse({
      contactName: "Anand Krishnan",
      contactEmail: "Anand@Example.COM",
      items: [{ variantId: validVariantId, quantity: "1" }],
    });
    expect(result.contactEmail).toBe("anand@example.com");
  });

  it("accepts a minimal valid request", () => {
    const result = quoteRequestInput.safeParse({
      contactName: "Anand Krishnan",
      contactEmail: "anand@example.com",
      items: [{ variantId: validVariantId, quantity: "400" }],
    });
    expect(result.success).toBe(true);
  });
});
