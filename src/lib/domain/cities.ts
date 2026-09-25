/**
 * The cities listed under "Browse by city", whether or not any pro has joined
 * there yet. Each one's provider count grows as vendors in that city go live.
 *
 * Admins manage the list (the City table). This built-in copy is what that
 * table was seeded with, and what the site falls back to if it is empty or
 * unreachable.
 *
 * `name` must be exactly what `cityFor` derives from a postcode in that city
 * (the ONS district, or "London" for all of Greater London), because vendors
 * are counted by their Beauty Hub's city. A test checks the slugs stay unique.
 *
 * Photographed cities first, then by population; cities with more pros are
 * always shown first. Must match the seeded order in the City table.
 */
export interface LaunchCity {
  name: string;
  /** Shown on the tile when it reads better than the district name. */
  label?: string;
  /** Photograph URL in the media library. */
  image?: string;
  /** A central outward code, used as the search area for the city. */
  outcode: string;
  lat: number;
  lng: number;
}

export const LAUNCH_CITIES: readonly LaunchCity[] = [
  { name: "London", image: "https://ik.imagekit.io/glamnetapp/London%20City.png", outcode: "WC2N", lat: 51.5072, lng: -0.1283 },
  { name: "Birmingham", image: "https://ik.imagekit.io/glamnetapp/Birminigham%20City.png", outcode: "B2", lat: 52.4777, lng: -1.898 },
  { name: "Manchester", image: "https://ik.imagekit.io/glamnetapp/Manchester%20City.png", outcode: "M2", lat: 53.4793, lng: -2.2446 },
  { name: "Leeds", image: "https://ik.imagekit.io/glamnetapp/Leeds%20city.png", outcode: "LS1", lat: 53.7951, lng: -1.5467 },
  { name: "Liverpool", image: "https://ik.imagekit.io/glamnetapp/Liverpool%20city.png", outcode: "L1", lat: 53.4064, lng: -2.9789 },
  { name: "Sheffield", image: "https://ik.imagekit.io/glamnetapp/Sheffield%20city.png", outcode: "S1", lat: 53.3804, lng: -1.4699 },
  { name: "Portsmouth", image: "https://ik.imagekit.io/glamnetapp/Portsmouth.png", outcode: "PO1", lat: 50.7973, lng: -1.0913 },
  { name: "Glasgow", image: "https://ik.imagekit.io/glamnetapp/Glasgow.png", outcode: "G1", lat: 55.8612, lng: -4.2447 },
  { name: "Bristol", image: "https://ik.imagekit.io/glamnetapp/Bristol.png", outcode: "BS1", lat: 51.4517, lng: -2.5969 },
  { name: "Coventry", image: "https://ik.imagekit.io/glamnetapp/Coventry.png", outcode: "CV1", lat: 52.4079, lng: -1.5118 },
  { name: "Bradford", image: "https://ik.imagekit.io/glamnetapp/Bradford.png", outcode: "BD1", lat: 53.7923, lng: -1.7533 },
  { name: "Cardiff", image: "https://ik.imagekit.io/glamnetapp/Caddiff.png", outcode: "CF10", lat: 51.4758, lng: -3.1792 },
  { name: "Belfast", image: "https://ik.imagekit.io/glamnetapp/Belfast.png", outcode: "BT1", lat: 54.5966, lng: -5.9301 },
  { name: "Nottingham", image: "https://ik.imagekit.io/glamnetapp/Nottingham.png", outcode: "NG1", lat: 52.9535, lng: -1.1478 },
  { name: "Newcastle upon Tyne", image: "https://ik.imagekit.io/glamnetapp/Newcastle.png", label: "Newcastle", outcode: "NE1", lat: 54.9803, lng: -1.6157 },
  { name: "Southampton", image: "https://ik.imagekit.io/glamnetapp/Southampton.png", outcode: "SO14", lat: 50.9078, lng: -1.4043 },
  { name: "Brighton and Hove", image: "https://ik.imagekit.io/glamnetapp/Brighton.png", label: "Brighton & Hove", outcode: "BN1", lat: 50.825, lng: -0.1388 },
  { name: "Milton Keynes", image: "https://ik.imagekit.io/glamnetapp/Miltoon%20Keynes.png", outcode: "MK9", lat: 52.0426, lng: -0.758 },
  { name: "Wolverhampton", image: "https://ik.imagekit.io/glamnetapp/Wolverhampton.png", outcode: "WV1", lat: 52.586, lng: -2.1293 },
  { name: "Derby", image: "https://ik.imagekit.io/glamnetapp/Derby.png", outcode: "DE1", lat: 52.9243, lng: -1.4888 },
  { name: "Plymouth", image: "https://ik.imagekit.io/glamnetapp/Plymouth.png", outcode: "PL1", lat: 50.3725, lng: -4.1378 },
  { name: "Aberdeen", image: "https://ik.imagekit.io/glamnetapp/Aberdeen.png", outcode: "AB10", lat: 57.1496, lng: -2.0969 },
  { name: "Cambridge", image: "https://ik.imagekit.io/glamnetapp/Cambridge.png", outcode: "CB2", lat: 52.2048, lng: 0.1193 },
  { name: "Edinburgh", outcode: "EH1", lat: 55.9503, lng: -3.193 },
  { name: "Leicester", outcode: "LE1", lat: 52.635, lng: -1.1372 },
  { name: "Reading", outcode: "RG1", lat: 51.4571, lng: -0.9699 },
  { name: "Luton", outcode: "LU1", lat: 51.8817, lng: -0.418 },
  { name: "Stoke-on-Trent", outcode: "ST1", lat: 53.0244, lng: -2.1763 },
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
  /** Brand media path, or null to draw the metal tile. */
  image: string | null;
}

/**
 * The "Browse by city" rail: every launch city, plus any other city where a
 * pro is already live, each with its live-pro count. Busiest first; ties keep
 * the admin's order, and cities off the list follow alphabetically.
 */
export function cityTiles(
  configured: readonly LaunchCity[],
  live: { city: string; hubId: string; sector: string; providerCount: number }[],
  /** Cities an admin has hidden: never shown, even once pros are live there. */
  hidden: ReadonlySet<string> = new Set(),
): CityTile[] {
  const byCity = new Map<string, { hubId: string; sector: string; providerCount: number; best: number }>();
  for (const hub of live) {
    const key = hub.city.toLowerCase();
    const entry = byCity.get(key) ?? { hubId: hub.hubId, sector: hub.sector, providerCount: 0, best: -1 };
    entry.providerCount += hub.providerCount;
    // The busiest hub stands for the city when it isn't on the launch list.
    if (hub.providerCount > entry.best) Object.assign(entry, { hubId: hub.hubId, sector: hub.sector, best: hub.providerCount });
    byCity.set(key, entry);
  }

  const tiles: (CityTile & { order: number })[] = configured.map((city, order) => {
    const found = byCity.get(city.name.toLowerCase());
    return {
      city: city.name,
      label: city.label ?? city.name,
      image: city.image ?? null,
      sector: city.outcode,
      hubId: found?.hubId ?? null,
      providerCount: found?.providerCount ?? 0,
      order,
    };
  });
  const listed = new Set(configured.map((city) => city.name.toLowerCase()));
  for (const hub of live) {
    const key = hub.city.toLowerCase();
    if (listed.has(key) || hidden.has(key) || hub.providerCount === 0) continue;
    listed.add(key);
    const entry = byCity.get(key)!;
    tiles.push({ city: hub.city, label: hub.city, image: null, sector: entry.sector, hubId: entry.hubId, providerCount: entry.providerCount, order: Number.MAX_SAFE_INTEGER });
  }

  return tiles
    .sort((a, b) => b.providerCount - a.providerCount || a.order - b.order || a.city.localeCompare(b.city))
    .map((tile) => ({
      city: tile.city,
      label: tile.label,
      image: tile.image,
      sector: tile.sector,
      hubId: tile.hubId,
      providerCount: tile.providerCount,
    }));
}
