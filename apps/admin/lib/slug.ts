/**
 * Derives a URL slug from a name.
 *
 * Matches the `slug` schema in `@buildanta/api`: lowercase, alphanumeric, single
 * hyphens, no leading or trailing hyphen.
 *
 * The `+` in the separator pattern is the important part. The live prototype
 * stripped "&" without collapsing what surrounded it, so "Tiles & Flooring" became
 * `tiles--flooring` — a double hyphen in a public URL. Replacing *runs* of
 * non-alphanumerics with a single hyphen is what prevents that.
 *
 * A convenience for the form, never a substitute for validation: the server checks
 * whatever it receives.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // NFKD splits an accented letter into base + combining mark; dropping the marks
    // turns "Béton" into "beton" rather than losing the letter.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    // A trailing hyphen can reappear after the length cut.
    .replace(/-+$/g, "");
}
