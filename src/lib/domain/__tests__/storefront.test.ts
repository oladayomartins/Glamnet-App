import { describe, expect, it } from "vitest";
import { slugDraft, slugify } from "@/lib/domain/storefront";

describe("slugDraft", () => {
  it("keeps a trailing hyphen so the next word can be typed", () => {
    expect(slugDraft("grace-")).toBe("grace-");
    expect(slugDraft("Grace ")).toBe("grace-");
    expect(slugDraft("grace-b")).toBe("grace-b");
  });

  it("applies the same character rules as slugify", () => {
    expect(slugDraft("-Grâce  Braids!")).toBe("grace-braids-");
    expect(slugify("-Grâce  Braids!")).toBe("grace-braids");
  });

  it("settles to the slugify form for saving", () => {
    expect(slugify(slugDraft("grace-braids-"))).toBe("grace-braids");
  });
});
