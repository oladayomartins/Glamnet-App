import { describe, expect, it } from "vitest";
import {
  boundingBox,
  byDistance,
  cityFor,
  distanceKm,
  formatMiles,
  formatPostcode,
  outwardCode,
} from "../postcode";

describe("UK postcodes", () => {
  it("formats full postcodes from anywhere in the UK", () => {
    expect(formatPostcode("s102hn")).toBe("S10 2HN");
    expect(formatPostcode(" sw1a 1aa ")).toBe("SW1A 1AA");
    expect(formatPostcode("EH1-1YZ")).toBe("EH1 1YZ");
    expect(formatPostcode("bt11aa")).toBe("BT1 1AA");
    expect(formatPostcode("M1 1AE")).toBe("M1 1AE");
    expect(formatPostcode("S10")).toBeNull();
    expect(formatPostcode("hello")).toBeNull();
  });

  it("finds the outward code of a full postcode or an outward code alone", () => {
    expect(outwardCode("S10 2HN")).toBe("S10");
    expect(outwardCode("sw1a")).toBe("SW1A");
    expect(outwardCode("CF10 1EP")).toBe("CF10");
    expect(outwardCode("LS1")).toBe("LS1");
    expect(outwardCode("London")).toBeNull();
  });
});

describe("distance", () => {
  const sheffield = { lat: 53.3807, lng: -1.4702 };
  const leeds = { lat: 53.7997, lng: -1.5492 };

  it("measures in kilometres and reads in miles", () => {
    const km = distanceKm(sheffield, leeds);
    expect(km).toBeGreaterThan(45);
    expect(km).toBeLessThan(48);
    expect(formatMiles(km)).toBe("29 miles");
    expect(formatMiles(0.5)).toBe("0.3 miles");
    expect(formatMiles(1.6)).toBe("1 mile");
  });

  it("builds a box that contains every point within the radius", () => {
    const box = boundingBox(sheffield, 16);
    expect(box.minLat).toBeLessThan(sheffield.lat);
    expect(box.maxLng).toBeGreaterThan(sheffield.lng);
    expect(leeds.lat > box.maxLat).toBe(true);
  });

  it("sorts unknown distances last", () => {
    expect([null, 3, 1].sort(byDistance)).toEqual([1, 3, null]);
  });
});

describe("cityFor", () => {
  it("treats London as one city and drops ONS suffixes", () => {
    expect(cityFor({ adminDistrict: "Westminster", region: "London" })).toBe("London");
    expect(cityFor({ adminDistrict: "Bristol, City of", region: "South West" })).toBe("Bristol");
    expect(cityFor({ adminDistrict: "Glasgow City", region: null })).toBe("Glasgow");
    expect(cityFor({ adminDistrict: "City of Edinburgh", region: null })).toBe("Edinburgh");
    expect(cityFor({ adminDistrict: "Kingston upon Hull, City of", region: "Yorkshire and The Humber" })).toBe("Kingston upon Hull");
    expect(cityFor({ adminDistrict: null, region: null })).toBe("United Kingdom");
  });
});
