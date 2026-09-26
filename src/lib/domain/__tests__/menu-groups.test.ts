import { describe, expect, it } from "vitest";
import { menuGroup, menuGroups } from "@/lib/domain/specialty-hubs";

describe("menuGroup", () => {
  it("folds both hair hubs into Hair", () => {
    expect(menuGroup("Afro & Textured")).toBe("Hair");
    expect(menuGroup("European & Western")).toBe("Hair");
  });

  it("gives makeup, nails and massage short names", () => {
    expect(menuGroup("MUA Glam & Asian Bridal")).toBe("Makeup");
    expect(menuGroup("Manicures & Pedicures")).toBe("Nails");
    expect(menuGroup("Massage & Wellness")).toBe("Massage");
  });

  it("keeps a category it doesn't know as it is", () => {
    expect(menuGroup("Lashes")).toBe("Lashes");
  });
});

describe("menuGroups", () => {
  it("lists each group once, in menu order", () => {
    expect(
      menuGroups(["Afro & Textured", "MUA Glam & Asian Bridal", "European & Western", "Manicures & Pedicures"]),
    ).toEqual(["Hair", "Makeup", "Nails"]);
  });
});
