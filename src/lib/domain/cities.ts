/**
 * The UK cities the home page lists under "Browse by city" from day one,
 * whether or not any pro has joined there yet. Each one's provider count
 * grows as vendors in that city go live.
 *
 * `name` must be exactly what `cityFor` derives from a postcode in that city
 * (the ONS district, or "London" for all of Greater London), because vendors
 * are counted by their Beauty Hub's city. A test checks the slugs stay unique.
 *
 * In rough order of population; cities with more pros are shown first.
 */
export interface LaunchCity {
  name: string;
  /** Shown on the tile when it reads better than the district name. */
  label?: string;
  /** A central outward code, used as the search area for the city. */
  outcode: string;
  lat: number;
  lng: number;
}

export const LAUNCH_CITIES: readonly LaunchCity[] = [
  { name: "London", outcode: "WC2N", lat: 51.5072, lng: -0.1283 },
  { name: "Birmingham", outcode: "B2", lat: 52.4777, lng: -1.898 },
  { name: "Manchester", outcode: "M2", lat: 53.4793, lng: -2.2446 },
  { name: "Leeds", outcode: "LS1", lat: 53.7951, lng: -1.5467 },
  { name: "Glasgow", outcode: "G1", lat: 55.8612, lng: -4.2447 },
  { name: "Liverpool", outcode: "L1", lat: 53.4064, lng: -2.9789 },
  { name: "Bristol", outcode: "BS1", lat: 51.4517, lng: -2.5969 },
  { name: "Sheffield", outcode: "S1", lat: 53.3804, lng: -1.4699 },
  { name: "Edinburgh", outcode: "EH1", lat: 55.9503, lng: -3.193 },
  { name: "Leicester", outcode: "LE1", lat: 52.635, lng: -1.1372 },
  { name: "Coventry", outcode: "CV1", lat: 52.4079, lng: -1.5118 },
  { name: "Bradford", outcode: "BD1", lat: 53.7923, lng: -1.7533 },
  { name: "Cardiff", outcode: "CF10", lat: 51.4758, lng: -3.1792 },
  { name: "Belfast", outcode: "BT1", lat: 54.5966, lng: -5.9301 },
  { name: "Nottingham", outcode: "NG1", lat: 52.9535, lng: -1.1478 },
  { name: "Newcastle upon Tyne", label: "Newcastle", outcode: "NE1", lat: 54.9803, lng: -1.6157 },
  { name: "Southampton", outcode: "SO14", lat: 50.9078, lng: -1.4043 },
  { name: "Brighton and Hove", label: "Brighton & Hove", outcode: "BN1", lat: 50.825, lng: -0.1388 },
  { name: "Reading", outcode: "RG1", lat: 51.4571, lng: -0.9699 },
  { name: "Milton Keynes", outcode: "MK9", lat: 52.0426, lng: -0.758 },
  { name: "Luton", outcode: "LU1", lat: 51.8817, lng: -0.418 },
  { name: "Wolverhampton", outcode: "WV1", lat: 52.586, lng: -2.1293 },
  { name: "Derby", outcode: "DE1", lat: 52.9243, lng: -1.4888 },
  { name: "Stoke-on-Trent", outcode: "ST1", lat: 53.0244, lng: -2.1763 },
  { name: "Plymouth", outcode: "PL1", lat: 50.3725, lng: -4.1378 },
  { name: "Portsmouth", outcode: "PO1", lat: 50.7973, lng: -1.0913 },
  { name: "Aberdeen", outcode: "AB10", lat: 57.1496, lng: -2.0969 },
  { name: "Cambridge", outcode: "CB2", lat: 52.2048, lng: 0.1193 },
  { name: "Oxford", outcode: "OX1", lat: 51.7549, lng: -1.2541 },
];

/** A launch city by its stored name, case-insensitively. */
export function launchCity(name: string): LaunchCity | undefined {
  const wanted = name.trim().toLowerCase();
  return LAUNCH_CITIES.find((city) => city.name.toLowerCase() === wanted);
}

export interface CityTile {
  city: string;
  label: string;
  /** Search area: the hub's outward code, or the city's central one. */
  sector: string;
  hubId: string | null;
  providerCount: number;
}

/**
 * The "Browse by city" rail: every launch city, plus any other city where a
 * pro is already live, each with its live-pro count. Busiest first; ties keep
 * the launch order, and cities off the list follow alphabetically.
 */
export function cityTiles(live: { city: string; hubId: string; sector: string; providerCount: number }[]): CityTile[] {
  const byCity = new Map<string, { hubId: string; sector: string; providerCount: number; best: number }>();
  for (const hub of live) {
    const key = hub.city.toLowerCase();
    const entry = byCity.get(key) ?? { hubId: hub.hubId, sector: hub.sector, providerCount: 0, best: -1 };
    entry.providerCount += hub.providerCount;
    // The busiest hub stands for the city when it isn't on the launch list.
    if (hub.providerCount > entry.best) Object.assign(entry, { hubId: hub.hubId, sector: hub.sector, best: hub.providerCount });
    byCity.set(key, entry);
  }

  const tiles: (CityTile & { order: number })[] = LAUNCH_CITIES.map((city, order) => {
    const found = byCity.get(city.name.toLowerCase());
    return {
      city: city.name,
      label: city.label ?? city.name,
      sector: city.outcode,
      hubId: found?.hubId ?? null,
      providerCount: found?.providerCount ?? 0,
      order,
    };
  });
  const listed = new Set(LAUNCH_CITIES.map((city) => city.name.toLowerCase()));
  for (const hub of live) {
    const key = hub.city.toLowerCase();
    if (listed.has(key) || hub.providerCount === 0) continue;
    listed.add(key);
    const entry = byCity.get(key)!;
    tiles.push({ city: hub.city, label: hub.city, sector: entry.sector, hubId: entry.hubId, providerCount: entry.providerCount, order: Number.MAX_SAFE_INTEGER });
  }

  return tiles
    .sort((a, b) => b.providerCount - a.providerCount || a.order - b.order || a.city.localeCompare(b.city))
    .map((tile) => ({
      city: tile.city,
      label: tile.label,
      sector: tile.sector,
      hubId: tile.hubId,
      providerCount: tile.providerCount,
    }));
}
