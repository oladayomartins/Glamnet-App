import { describe, expect, it } from "vitest";
import { safeNext } from "../safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/pro/amara-braids?via=directory")).toBe("/pro/amara-braids?via=directory");
  });

  it("refuses anything that leaves the site", () => {
    for (const hostile of ["//evil.example", "/\\evil.example", "https://evil.example", "evil"]) {
      expect(safeNext(hostile)).toBe("/account");
    }
  });

  it("falls back when missing", () => {
    expect(safeNext(undefined, "/provider")).toBe("/provider");
  });
});
