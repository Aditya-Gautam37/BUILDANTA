import { describe, expect, it } from "vitest";

import { slugify } from "./slug.js";

describe("slugify", () => {
  /**
   * The defect this function exists to prevent: buildanta.com strips "&" without
   * collapsing what surrounded it, producing `tiles--flooring` and
   * `sanitaryware--bathware` in public URLs. Replacing *runs* of non-alphanumeric
   * characters with a single hyphen — not one hyphen per character — is what
   * fixes it.
   */
  it("collapses '&' into a single hyphen, not two", () => {
    expect(slugify("Tiles & Flooring")).toBe("tiles-flooring");
    expect(slugify("Sanitaryware & Bathware")).toBe("sanitaryware-bathware");
    expect(slugify("Cement & Structure")).toBe("cement-structure");
  });

  it("lowercases the result", () => {
    expect(slugify("UltraTech Cement")).toBe("ultratech-cement");
  });

  it("strips accents rather than dropping the whole word", () => {
    // The apostrophe is punctuation, not an accent — it correctly becomes a
    // separator (a hyphen), same as the comma in the stage-name test below.
    // Only the accents on the letters themselves are stripped.
    expect(slugify("Béton Prêt à l'emploi")).toBe("beton-pret-a-l-emploi");
  });

  it("has no leading or trailing hyphen", () => {
    expect(slugify(" Cement ")).toBe("cement");
    expect(slugify("--Cement--")).toBe("cement");
  });

  it("collapses multiple separators of any kind into one hyphen", () => {
    expect(slugify("Doors, Windows, Railings & Glass")).toBe(
      "doors-windows-railings-glass",
    );
  });

  it("truncates to 120 characters without leaving a trailing hyphen", () => {
    const long = "a".repeat(130);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith("-")).toBe(false);
  });
});
