import { describe, expect, it } from "vitest";

import { addQuantities } from "./decimal";

describe("addQuantities", () => {
  /**
   * The exact bug this function exists to fix: plain `Number("0.1") + Number("0.2")`
   * is `0.30000000000000004` in JavaScript, which fails the shared `measurement`
   * regex (at most 3 decimal places) and turns clicking "add to quote" twice into
   * an inexplicable validation error.
   */
  it("adds 0.1 and 0.2 to exactly 0.3, not a float-drifted value", () => {
    expect(addQuantities("0.1", "0.2")).toBe("0.3");
  });

  it("adds whole numbers", () => {
    expect(addQuantities("400", "50")).toBe("450");
  });

  it("adds values with three decimal places", () => {
    expect(addQuantities("3.125", "1.875")).toBe("5");
  });

  it("trims trailing zeros from the result", () => {
    expect(addQuantities("1.5", "1.5")).toBe("3");
    expect(addQuantities("0.1", "0.05")).toBe("0.15");
  });

  it("handles a value with no fractional part combined with one that has one", () => {
    expect(addQuantities("2", "0.5")).toBe("2.5");
  });

  it("truncates a value with more than three decimal places rather than throwing", () => {
    // Not a shape either input should ever actually have — every quantity in this
    // app is produced by its own inputs — but the function does not need to
    // validate that, only not misbehave if it happens.
    expect(addQuantities("1.23456", "0")).toBe("1.234");
  });
});
