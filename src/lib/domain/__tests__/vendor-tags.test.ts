import { describe, expect, it } from "vitest";
import {
  VENDOR_AMENITIES,
  amenityLabel,
  isVendorAmenity,
  normaliseAmenities,
  vendorTags,
} from "@/lib/domain/vendor-tags";

describe("normaliseAmenities", () => {
  it("drops values it does not recognise rather than rejecting the save", () => {
    // A stale client or a renamed tag must not lock a vendor out of editing
    // their own profile.
    expect(normaliseAmenities(["PARKING", "TELEPORTER"])).toEqual(["PARKING"]);
  });

  it("collapses duplicates", () => {
    expect(normaliseAmenities(["PARKING", "PARKING"])).toEqual(["PARKING"]);
  });

  it("imposes the catalogue's order, whatever order it is given", () => {
    const forwards = normaliseAmenities(["PARKING", "KIDS_WELCOME"]);
    const backwards = normaliseAmenities(["KIDS_WELCOME", "PARKING"]);
    expect(forwards).toEqual(backwards);
    expect(forwards).toEqual(["KIDS_WELCOME", "PARKING"]);
  });

  it("returns nothing for an empty or all-junk list", () => {
    expect(normaliseAmenities([])).toEqual([]);
    expect(normaliseAmenities(["", "nope"])).toEqual([]);
  });
});

describe("isVendorAmenity", () => {
  it("accepts every catalogued value and nothing else", () => {
    for (const tag of VENDOR_AMENITIES) expect(isVendorAmenity(tag.value)).toBe(true);
    expect(isVendorAmenity("CARD_PAYMENTS")).toBe(false);
  });
});

describe("amenityLabel", () => {
  it("falls back to the raw value rather than rendering blank", () => {
    expect(amenityLabel("PARKING")).toBe("Parking available");
    expect(amenityLabel("MYSTERY")).toBe("MYSTERY");
  });
});

describe("vendorTags", () => {
  it("leads with where they work and whether they come to you", () => {
    const tags = vendorTags({
      workspaceType: "HOME_SALON",
      travelsToClients: true,
      amenities: ["PARKING"],
    });
    expect(tags.map((tag) => tag.label)).toEqual([
      "Home studio",
      "Travels to you",
      "Parking available",
    ]);
  });

  it("does not give a mobile vendor a workspace tag", () => {
    const tags = vendorTags({
      workspaceType: "MOBILE",
      travelsToClients: true,
      amenities: [],
    });
    expect(tags.map((tag) => tag.label)).toEqual(["Travels to you"]);
  });

  it("says a mobile vendor travels even if the flag was never set", () => {
    // Travelling is what MOBILE means; the two cannot disagree on a storefront.
    const tags = vendorTags({
      workspaceType: "MOBILE",
      travelsToClients: false,
      amenities: [],
    });
    expect(tags.map((tag) => tag.label)).toContain("Travels to you");
  });

  it("omits Travels to you for a studio vendor who does not", () => {
    const tags = vendorTags({
      workspaceType: "PRIVATE_ROOM",
      travelsToClients: false,
      amenities: [],
    });
    expect(tags.map((tag) => tag.label)).toEqual(["Private room"]);
  });

  it("marks derived tags so they are never offered as filters", () => {
    const tags = vendorTags({
      workspaceType: "HOME_SALON",
      travelsToClients: false,
      amenities: ["KIDS_WELCOME"],
    });
    expect(tags.filter((tag) => tag.derived).map((t) => t.label)).toEqual([
      "Home studio",
    ]);
    expect(tags.filter((tag) => !tag.derived).map((t) => t.label)).toEqual([
      "Kids welcome",
    ]);
  });

  it("drops junk amenities on the way to the storefront too", () => {
    const tags = vendorTags({
      workspaceType: "MOBILE",
      travelsToClients: true,
      amenities: ["KIDS_WELCOME", "NONSENSE"],
    });
    expect(tags.map((tag) => tag.label)).toEqual([
      "Travels to you",
      "Kids welcome",
    ]);
  });
});
