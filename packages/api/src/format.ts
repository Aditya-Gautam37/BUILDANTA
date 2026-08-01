/**
 * Display formatting shared by the storefront and the admin app, so a price is
 * never rendered two different ways in one system.
 */

const UNIT_LABELS: Record<string, { short: string; long: string }> = {
  PIECE: { short: "pc", long: "piece" },
  BAG: { short: "bag", long: "bag" },
  BOX: { short: "box", long: "box" },
  BUNDLE: { short: "bundle", long: "bundle" },
  ROLL: { short: "roll", long: "roll" },
  SHEET: { short: "sheet", long: "sheet" },
  METRE: { short: "m", long: "metre" },
  SQUARE_METRE: { short: "m²", long: "square metre" },
  CUBIC_METRE: { short: "m³", long: "cubic metre" },
  LITRE: { short: "L", long: "litre" },
  KILOGRAM: { short: "kg", long: "kilogram" },
  TONNE: { short: "t", long: "tonne" },
};

export function formatUnit(
  unit: string,
  form: "short" | "long" = "short",
): string {
  return UNIT_LABELS[unit]?.[form] ?? unit.toLowerCase().replace(/_/g, " ");
}

/**
 * Formats a decimal money string for display.
 *
 * Takes a string, not a number, because that is what the API returns — parsing to
 * a float first is how rounding errors get into a price. `Intl` does need a
 * number, so the conversion happens at the last possible moment, on a value
 * already fixed to two decimals.
 *
 * The locale defaults to en-IN: this catalog is priced in rupees, and Indian
 * digit grouping (1,25,000 rather than 125,000) is what a buyer here expects.
 */
export function formatMoney(
  amount: string | null,
  currency: string | null,
  locale = "en-IN",
): string {
  if (amount === null) return "—";

  const code = (currency ?? "INR").trim().toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      // Construction prices are quoted whole far more often than not, so a
      // trailing ".00" is noise — but a real fractional price still shows.
      minimumFractionDigits: amount.endsWith(".00") ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    // An unknown or malformed currency code must not blank out the price.
    return `${code} ${amount}`;
  }
}

/** "from ₹1,250" when a product's variants differ in price. */
export function formatPriceRange(
  from: string | null,
  to: string | null,
  currency: string | null,
  locale = "en-IN",
): string {
  if (from === null) return "Price on request";
  if (to === null || from === to) return formatMoney(from, currency, locale);
  return `from ${formatMoney(from, currency, locale)}`;
}

/** Trims trailing zeros from a measurement: "3.500" reads as "3.5". */
export function formatQuantity(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
