import { describe, expect, it } from "vitest";

import { formatMoney, formatPriceRange, formatQuantity, formatUnit } from "./format.js";

describe("formatMoney", () => {
  it("formats a whole-number amount without decimals", () => {
    // Construction prices are quoted whole far more often than not, so a
    // trailing ".00" is treated as noise.
    expect(formatMoney("1250.00", "INR")).toBe("₹1,250");
  });

  it("keeps a genuine fractional amount", () => {
    expect(formatMoney("1250.50", "INR")).toBe("₹1,250.50");
  });

  it("uses Indian digit grouping", () => {
    // 1,25,000 not 125,000 — this is the grouping an en-IN buyer expects, and
    // getting it wrong is the kind of thing that reads as "foreign software".
    expect(formatMoney("125000.00", "INR")).toBe("₹1,25,000");
  });

  it("renders the placeholder em dash for a null amount", () => {
    expect(formatMoney(null, "INR")).toBe("—");
  });

  it("falls back to a currency-prefixed string for a malformed currency code", () => {
    // "123" is not a well-formed ISO 4217 code (three letters), which is what makes
    // Intl throw here — a merely *unassigned* code like "XXX" is well-formed and
    // Intl renders it with a generic symbol instead. Either way the price must not
    // be blanked out.
    expect(formatMoney("100.00", "123")).toBe("123 100.00");
  });

  it("defaults to INR when no currency is given", () => {
    expect(formatMoney("100.00", null)).toBe("₹100");
  });
});

describe("formatPriceRange", () => {
  it("shows a plain price when there is one price point", () => {
    expect(formatPriceRange("500.00", "500.00", "INR")).toBe("₹500");
  });

  it("prefixes 'from' when the range has a spread", () => {
    expect(formatPriceRange("500.00", "900.00", "INR")).toBe("from ₹500");
  });

  it("reads as 'price on request' rather than a currency symbol with nothing after it", () => {
    expect(formatPriceRange(null, null, "INR")).toBe("Price on request");
  });
});

describe("formatUnit", () => {
  it("returns the long form for a known unit", () => {
    expect(formatUnit("SQUARE_METRE", "long")).toBe("square metre");
    expect(formatUnit("TONNE", "long")).toBe("tonne");
  });

  it("returns the short form by default", () => {
    expect(formatUnit("KILOGRAM")).toBe("kg");
  });

  it("degrades to a readable guess for an unrecognised unit rather than throwing", () => {
    expect(formatUnit("CUBIC_FOOT")).toBe("cubic foot");
  });
});

describe("formatQuantity", () => {
  it("trims trailing zeros from a measurement", () => {
    expect(formatQuantity("3.500")).toBe("3.5");
    expect(formatQuantity("40.000")).toBe("40");
  });

  it("leaves a whole number without a decimal point untouched", () => {
    expect(formatQuantity("400")).toBe("400");
  });

  it("leaves a genuinely precise value untouched", () => {
    expect(formatQuantity("3.125")).toBe("3.125");
  });
});
