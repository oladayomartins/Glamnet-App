import { describe, expect, it } from "vitest";
import { featuredMenu } from "@/lib/domain/featured-menu";

const service = (
  id: string,
  priceMinor: number,
  extra: { kind?: string; isFeatured?: boolean } = {},
) => ({ id, priceMinor, kind: extra.kind ?? "SERVICE", isFeatured: extra.isFeatured });

const MENU = [
  service("braids", 8_000),
  service("silk-press", 5_000),
  service("gele", 3_000),
  service("updo", 9_000),
  service("treatment", 4_000),
  service("lashes", 2_000, { kind: "ADDON" }),
];

describe("featuredMenu without pins", () => {
  it("leads with the cheapest bookable services, not an arbitrary sort", () => {
    const { featured } = featuredMenu(MENU);
    expect(featured.map((s) => s.id)).toEqual([
      "gele",
      "treatment",
      "silk-press",
      "braids",
    ]);
  });

  it("never leads with an add-on — nobody books lashes on their own", () => {
    const { featured } = featuredMenu(MENU);
    expect(featured.map((s) => s.id)).not.toContain("lashes");
  });

  it("counts the hidden against the whole menu, add-ons included", () => {
    // "See all 2" has to match what the customer finds when they tap it.
    const { hiddenCount } = featuredMenu(MENU);
    expect(hiddenCount).toBe(MENU.length - 4);
  });

  it("reports nothing hidden for a menu that already fits", () => {
    const short = featuredMenu(MENU.slice(0, 3));
    expect(short.hiddenCount).toBe(0);
    expect(short.featured).toHaveLength(3);
  });

  it("says the vendor did not choose these", () => {
    expect(featuredMenu(MENU).pinned).toBe(false);
  });
});

describe("featuredMenu with pins", () => {
  const pinned = [
    service("braids", 8_000, { isFeatured: true }),
    service("silk-press", 5_000),
    service("gele", 3_000),
    service("updo", 9_000, { isFeatured: true }),
  ];

  it("shows exactly what the vendor pinned, price order be damned", () => {
    const { featured, pinned: wasPinned } = featuredMenu(pinned);
    expect(featured.map((s) => s.id)).toEqual(["braids", "updo"]);
    expect(wasPinned).toBe(true);
  });

  it("keeps every pin even past the limit — they asked for them", () => {
    const many = [1, 2, 3, 4, 5, 6].map((n) =>
      service(`s${n}`, n * 1_000, { isFeatured: true }),
    );
    expect(featuredMenu(many).featured).toHaveLength(6);
    expect(featuredMenu(many).hiddenCount).toBe(0);
  });

  it("ignores a pin on an add-on rather than leading with it", () => {
    const odd = [
      service("gele", 3_000),
      service("lashes", 2_000, { kind: "ADDON", isFeatured: true }),
    ];
    expect(featuredMenu(odd).featured.map((s) => s.id)).toEqual(["gele"]);
  });

  it("falls back cleanly when a menu is empty", () => {
    const empty = featuredMenu([]);
    expect(empty.featured).toEqual([]);
    expect(empty.hiddenCount).toBe(0);
    expect(empty.pinned).toBe(false);
  });
});
