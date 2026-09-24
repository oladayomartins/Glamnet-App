/**
 * UK postcodes and distance (Open Marketplace Directory §A, now UK-wide).
 *
 * The directory, search and broadcast work anywhere in the UK. Real
 * coordinates come from the ONS postcode directory (via postcodes.io, see
 * lib/server/geo.ts); this module is the pure part: recognising and tidying
 * what people type, and measuring between points.
 *
 * Privacy rule, unchanged: a vendor's full postcode is private. Publicly they
 * are placed at their *outward code* (the "S10" of "S10 2HN"), so a map or a
 * distance can never be used to find someone's home salon.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** A full UK postcode, loosely: outward code, optional space, inward code. */
const FULL = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
/** An outward code on its own: "S10", "SW1A", "BT1". */
const OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;

function clean(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "s102hn" → "S10 2HN"; null if it is not shaped like a full postcode. */
export function formatPostcode(input: string): string | null {
  const match = clean(input).match(FULL);
  return match ? `${match[1]} ${match[2]}` : null;
}

/**
 * The outward code of a full postcode or of an outward code typed alone:
 * "s10 2hn" → "S10", " sw1a " → "SW1A". Null for anything else.
 */
export function outwardCode(input: string): string | null {
  const compact = clean(input);
  const full = compact.match(FULL);
  if (full) return full[1];
  if (OUTWARD.test(compact)) return compact;
  // A half-typed postcode with its space, "S11 8", still names its area.
  const first = clean(input.trim().split(/\s+/)[0] ?? "");
  return OUTWARD.test(first) ? first : null;
}

/** Kept for existing callers: an outward code, anywhere in the UK. */
export const normaliseSector = outwardCode;

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

export const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

/** "0.4 miles", "3 miles", "12 miles". */
export function formatMiles(km: number): string {
  const miles = kmToMiles(km);
  if (miles < 0.95) return `${miles.toFixed(1)} miles`;
  const rounded = Math.round(miles);
  return `${rounded} mile${rounded === 1 ? "" : "s"}`;
}

/**
 * A lat/lng box around a point, for a cheap database pre-filter before the
 * exact great-circle check.
 */
export function boundingBox(centre: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.01, Math.cos((centre.lat * Math.PI) / 180)));
  return {
    minLat: centre.lat - dLat,
    maxLat: centre.lat + dLat,
    minLng: centre.lng - dLng,
    maxLng: centre.lng + dLng,
  };
}

/** Sort key helper: unknown distances sort after every known one. */
export function byDistance(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * The town a postcode belongs to, for directory pages. London is one city
 * rather than 33 boroughs; ONS names like "Bristol, City of" lose the suffix.
 */
export function cityFor(place: { adminDistrict: string | null; region: string | null }): string {
  if (place.region === "London") return "London";
  const district = (place.adminDistrict ?? "")
    .replace(/,\s*(City|County) of$/i, "")
    .replace(/^City of\s+/i, "")
    .replace(/\s+City$/i, "")
    .trim();
  return district || "United Kingdom";
}

/** Radius choices offered in the directory, in miles. */
export const RADIUS_MILES = [2, 5, 10, 25] as const;
export const DEFAULT_RADIUS_MILES = 10;

/** How far a broadcast request reaches from the customer's area. */
export const BROADCAST_RADIUS_KM = milesToKm(10);

/** A city's directory URL segment: "Stoke-on-Trent" → "stoke-on-trent". */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
