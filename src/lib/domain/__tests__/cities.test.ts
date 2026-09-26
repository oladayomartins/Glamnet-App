import { describe, expect, it } from "vitest";
import { LAUNCH_CITIES, cityTiles, launchCity } from "../cities";
import { citySlug } from "../postcode";

describe("launch cities", () => {
  it("have unique names and URL slugs", () => {
    const slugs = LAUNCH_CITIES.map((city) => citySlug(city.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("finds a city whatever the case", () => {
    expect(launchCity("brighton AND hove")?.label).toBe("Brighton & Hove");
    expect(launchCity("Atlantis")).toBeUndefined();
  });
});

describe("cityTiles", () => {
  it("lists every launch city even with no pros yet", () => {
    const tiles = cityTiles(LAUNCH_CITIES, []);
    expect(tiles).toHaveLength(LAUNCH_CITIES.length);
    expect(tiles.every((tile) => tile.providerCount === 0)).toBe(true);
    expect(tiles[0].city).toBe("London");
  });

  it("adds up pros across a city's areas and puts the busiest first", () => {
    const tiles = cityTiles(LAUNCH_CITIES, [
      { city: "Leeds", hubId: "h1", sector: "LS1", providerCount: 2 },
      { city: "Leeds", hubId: "h2", sector: "LS6", providerCount: 1 },
      { city: "London", hubId: "h3", sector: "RM9", providerCount: 1 },
    ]);
    expect(tiles[0]).toMatchObject({ city: "Leeds", providerCount: 3 });
    expect(tiles[1]).toMatchObject({ city: "London", providerCount: 1 });
    // A launch city keeps its central area as the search area.
    expect(tiles[1].sector).toBe("WC2N");
  });

  it("includes a city off the list once a pro is live there", () => {
    const tiles = cityTiles(LAUNCH_CITIES, [
      { city: "Dartford", hubId: "h1", sector: "DA1", providerCount: 1 },
      { city: "Salford", hubId: "h2", sector: "M5", providerCount: 0 },
    ]);
    expect(tiles.find((tile) => tile.city === "Dartford")).toMatchObject({ providerCount: 1, sector: "DA1" });
    expect(tiles.find((tile) => tile.city === "Salford")).toBeUndefined();
  });

  it("keeps a city an admin hid off the rail, pros or not", () => {
    const tiles = cityTiles(LAUNCH_CITIES, [{ city: "Dartford", hubId: "h1", sector: "DA1", providerCount: 2 }], new Set(["dartford"]));
    expect(tiles.find((tile) => tile.city === "Dartford")).toBeUndefined();
  });
});
