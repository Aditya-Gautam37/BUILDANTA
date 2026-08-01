/**
 * Adds two decimal-string quantities without floating-point drift.
 *
 * Quantities flow into a `Decimal(12,3)` column, and the basket increments one
 * with plain `Number` arithmetic used to do exactly what that column exists to
 * avoid: `Number("0.1") + Number("0.2")` is `0.30000000000000004` in JavaScript,
 * a string with 17 decimal places that then fails the shared `measurement` regex
 * (at most 3 decimal places) on both this form and the server, turning "add to
 * quote" twice into a confusing validation error. This does the addition as
 * integers scaled by 1000 (matching the column's precision), so there is no
 * float involved at any point.
 */
export function addQuantities(a: string, b: string): string {
  const scale = 1000n;

  const toScaledInt = (value: string): bigint => {
    const [wholePart = "0", fractionPart = ""] = value.split(".");
    // Padded to exactly 3 digits and truncated if longer, matching the column's
    // precision — a caller passing a malformed string here is a bug elsewhere,
    // not something this function needs to validate.
    const fraction = fractionPart.padEnd(3, "0").slice(0, 3);
    return BigInt(wholePart || "0") * scale + BigInt(fraction || "0");
  };

  const sum = toScaledInt(a) + toScaledInt(b);
  const whole = sum / scale;
  const fraction = (sum % scale).toString().padStart(3, "0");

  // Trailing zeros trimmed for display — "4.100" and "4.1" are the same
  // quantity, and the shorter form is what a plain number input shows anyway.
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : `${whole}`;
}
