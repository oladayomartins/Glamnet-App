/**
 * Sheffield "S" postcode sectors, for the directory's proximity sort
 * (Open Marketplace Directory §A).
 *
 * Strictly these are postcode *districts* (S1, S10, S11…), which is what the
 * spec calls a sector and what the rest of the app stores in `Hub.sector`.
 * Centroids are approximate — good to a few hundred metres — which is all a
 * "nearest first" sort needs. Anything outside this table sorts last rather
 * than being dropped.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const SHEFFIELD_SECTORS: Record<string, LatLng> = {
  S1: { lat: 53.3807, lng: -1.4702 },
  S2: { lat: 53.3693, lng: -1.4556 },
  S3: { lat: 53.3884, lng: -1.4777 },
  S4: { lat: 53.4007, lng: -1.4501 },
  S5: { lat: 53.4225, lng: -1.4617 },
  S6: { lat: 53.3968, lng: -1.5132 },
  S7: { lat: 53.3509, lng: -1.4943 },
  S8: { lat: 53.3380, lng: -1.4746 },
  S9: { lat: 53.4007, lng: -1.4107 },
  S10: { lat: 53.3786, lng: -1.5237 },
  S11: { lat: 53.3634, lng: -1.5051 },
  S12: { lat: 53.3448, lng: -1.4094 },
  S13: { lat: 53.3693, lng: -1.3826 },
  S14: { lat: 53.3501, lng: -1.4413 },
  S17: { lat: 53.3219, lng: -1.5397 },
  S20: { lat: 53.3339, lng: -1.3590 },
  S35: { lat: 53.4513, lng: -1.4985 },
  S36: { lat: 53.4895, lng: -1.6040 },
};

/**
 * Normalise free text to an outward code: "s10 2hn" → "S10", " S1" → "S1".
 * Returns null for anything that is not an S postcode.
 */
export function normaliseSector(input: string): string | null {
  const match = input.trim().toUpperCase().match(/^(S\d{1,2})(?:\s*\d[A-Z]{0,2})?$/);
  return match ? match[1] : null;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The known sector whose centroid is closest to a point. */
export function nearestSector(point: LatLng): string {
  let best = "S1";
  let bestDistance = Infinity;
  for (const [sector, centroid] of Object.entries(SHEFFIELD_SECTORS)) {
    const distance = distanceKm(point, centroid);
    if (distance < bestDistance) {
      best = sector;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Distance between two sectors' centroids, or null when either is unknown.
 * Same sector is zero.
 */
export function sectorDistanceKm(from: string, to: string): number | null {
  if (from === to) return 0;
  const a = SHEFFIELD_SECTORS[from];
  const b = SHEFFIELD_SECTORS[to];
  return a && b ? distanceKm(a, b) : null;
}

/** Sort key helper: unknown distances sort after every known one. */
export function byDistance(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
