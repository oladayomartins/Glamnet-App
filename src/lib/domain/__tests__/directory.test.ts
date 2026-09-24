import { describe, expect, it } from "vitest";
import {
  crossSellFor,
  MUA_BRIDAL_HUB,
  NAILS_HUB,
  SPECIALTY_HUBS,
} from "../specialty-hubs";
import {
  byDistance,
  nearestSector,
  normaliseSector,
  SHEFFIELD_SECTORS,
  sectorDistanceKm,
} from "../postcode";
import { isValidSlug, slugify } from "../storefront";

describe("specialty hubs", () => {
  it("has the five hubs from the directory spec", () => {
    expect(SPECIALTY_HUBS.map((hub) => hub.slug)).toEqual([
      "afro-textured",
      "european-western",
      "mua-bridal",
      "nails",
      "massage-wellness",
    ]);
  });
});

describe("crossSellFor", () => {
  const nails = [
    { id: "soak", name: "Gel Removal Soak", category: NAILS_HUB, priceMinor: 1_000, durationMinutes: 20 },
    { id: "biab", name: "BIAB Dry Overlay", category: NAILS_HUB, priceMinor: 3_500, durationMinutes: 50 },
    { id: "massage", name: "Deep Tissue", category: "Massage & Wellness", priceMinor: 5_000, durationMinutes: 60 },
  ];

  it("recommends dry-treatment overlays first for a bridal basket", () => {
    expect(crossSellFor([MUA_BRIDAL_HUB], nails).map((c) => c.id)).toEqual([
      "biab",
      "soak",
    ]);
  });

  it("stays quiet without bridal work, or when nails are already in", () => {
    expect(crossSellFor(["Afro & Textured"], nails)).toEqual([]);
    expect(crossSellFor([MUA_BRIDAL_HUB, NAILS_HUB], nails)).toEqual([]);
  });

  it("never recommends what is already in the basket", () => {
    expect(
      crossSellFor([MUA_BRIDAL_HUB], nails, ["biab"]).map((c) => c.id),
    ).toEqual(["soak"]);
  });
});

describe("postcode sectors", () => {
  it("normalises full and partial postcodes to the outward code", () => {
    expect(normaliseSector("s10 2hn")).toBe("S10");
    expect(normaliseSector(" S1 ")).toBe("S1");
    expect(normaliseSector("S11 8")).toBe("S11");
    expect(normaliseSector("LS1")).toBeNull();
    expect(normaliseSector("hello")).toBeNull();
  });

  it("finds the sector a coordinate sits in", () => {
    expect(nearestSector(SHEFFIELD_SECTORS.S10)).toBe("S10");
  });

  it("sorts unknown sectors last", () => {
    expect(sectorDistanceKm("S10", "S10")).toBe(0);
    expect(sectorDistanceKm("S10", "LS1")).toBeNull();
    expect([null, 3, 1].sort(byDistance)).toEqual([1, 3, null]);
  });
});

describe("storefront slugs", () => {
  it("builds a link-safe handle", () => {
    expect(slugify("Grace's Braids ✨")).toBe("grace-s-braids");
    expect(slugify("  Zoë  Nails ")).toBe("zoe-nails");
  });

  it("rejects reserved and malformed handles", () => {
    expect(isValidSlug("grace-braids")).toBe(true);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
  });
});
