import type { Hub } from "@prisma/client";
import { prisma } from "./prisma";
import { cityFor, formatPostcode, outwardCode, type LatLng } from "@/lib/domain/postcode";

/**
 * UK postcode lookups, from the ONS Postcode Directory via postcodes.io.
 *
 * Free, keyless and UK-wide (England, Scotland, Wales, Northern Ireland).
 * Every call degrades to null rather than throwing: a lookup outage must make
 * the map and "nearest first" less helpful, never break a booking.
 *
 * Results are cached twice: in the Next data cache for a month (postcodes do
 * not move) and in memory for the life of the server instance.
 */

const API = process.env.POSTCODES_API_URL?.trim() || "https://api.postcodes.io";
const MONTH = 60 * 60 * 24 * 30;

export interface Place extends LatLng {
  /** "S10 2HN", or null when only an outward code was looked up. */
  postcode: string | null;
  /** "S10". */
  outcode: string;
  /** Directory city: "Sheffield", "London", "Bristol". */
  city: string;
  country: string | null;
}

const memory = new Map<string, Place | null>();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: MONTH },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface PostcodeResult {
  postcode: string;
  outcode: string;
  latitude: number | null;
  longitude: number | null;
  admin_district: string | null;
  region: string | null;
  country: string | null;
}

interface OutcodeResult {
  outcode: string;
  latitude: number | null;
  longitude: number | null;
  admin_district: string[] | null;
  country: string[] | null;
}

function fromPostcode(result: PostcodeResult): Place | null {
  if (result.latitude === null || result.longitude === null) return null;
  return {
    postcode: result.postcode,
    outcode: result.outcode,
    lat: result.latitude,
    lng: result.longitude,
    city: cityFor({ adminDistrict: result.admin_district, region: result.region }),
    country: result.country,
  };
}

/** A full postcode → its place, or null if it does not exist. */
export async function lookupPostcode(input: string): Promise<Place | null> {
  const postcode = formatPostcode(input);
  if (!postcode) return null;
  const key = `pc:${postcode}`;
  if (memory.has(key)) return memory.get(key)!;
  const body = await getJson<{ result: PostcodeResult }>(`/postcodes/${encodeURIComponent(postcode)}`);
  const place = body?.result ? fromPostcode(body.result) : null;
  // Only cache definite answers; a timeout (null body) may succeed next time.
  if (body) memory.set(key, place);
  return place;
}

/** An outward code → its centroid, or null. */
export async function lookupOutcode(input: string): Promise<Place | null> {
  const outcode = outwardCode(input);
  if (!outcode) return null;
  const key = `oc:${outcode}`;
  if (memory.has(key)) return memory.get(key)!;
  const body = await getJson<{ result: OutcodeResult }>(`/outcodes/${encodeURIComponent(outcode)}`);
  const result = body?.result;
  let place: Place | null = null;
  if (result && result.latitude !== null && result.longitude !== null) {
    // An outward code can straddle districts; name it after the district of
    // a real postcode at its centre, which is where most of it is.
    const centre = await reverseGeocode({ lat: result.latitude, lng: result.longitude });
    place = {
      postcode: null,
      outcode: result.outcode,
      lat: result.latitude,
      lng: result.longitude,
      city:
        centre?.outcode === result.outcode
          ? centre.city
          : cityFor({ adminDistrict: result.admin_district?.[0] ?? null, region: null }),
      country: result.country?.[0] ?? null,
    };
  }
  if (body) memory.set(key, place);
  return place;
}

/** Whatever was typed: a full postcode first, else an outward code. */
export async function lookupPlace(input: string): Promise<Place | null> {
  return formatPostcode(input) ? lookupPostcode(input) : lookupOutcode(input);
}

/** The postcode nearest a point (e.g. the browser's location). */
export async function reverseGeocode(point: LatLng): Promise<Place | null> {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  const body = await getJson<{ result: PostcodeResult[] | null }>(
    `/postcodes?lon=${point.lng.toFixed(6)}&lat=${point.lat.toFixed(6)}&limit=1&radius=2000`,
  );
  const first = body?.result?.[0];
  return first ? fromPostcode(first) : null;
}

/** Up to ten postcodes starting with what has been typed so far. */
export async function autocompletePostcodes(prefix: string): Promise<string[]> {
  const compact = prefix.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
  if (compact.replace(/ /g, "").length < 2) return [];
  // The service ignores the space, so "BT1 1" also matches BT11 postcodes.
  // Ask for more and keep only those that really start with what was typed.
  const spaced = compact.includes(" ");
  const body = await getJson<{ result: string[] | null }>(
    `/postcodes/${encodeURIComponent(compact.replace(/ /g, ""))}/autocomplete?limit=${spaced ? 100 : 8}`,
  );
  const results = body?.result ?? [];
  return (spaced ? results.filter((postcode) => postcode.startsWith(compact.replace(/\s+/g, " "))) : results).slice(0, 8);
}

/**
 * The Beauty Hub for a place: one per outward code, anywhere in the UK,
 * created the first time anyone there signs up or searches.
 */
export async function hubForPlace(place: Place): Promise<Hub> {
  const existing = await prisma.hub.findUnique({ where: { sector: place.outcode } });
  if (existing) {
    if (existing.latitude === null || existing.longitude === null) {
      const centre = await lookupOutcode(place.outcode);
      return prisma.hub.update({
        where: { id: existing.id },
        data: { latitude: centre?.lat ?? place.lat, longitude: centre?.lng ?? place.lng },
      });
    }
    return existing;
  }
  const centre = place.postcode ? await lookupOutcode(place.outcode) : place;
  const data = {
    name: `${(centre ?? place).city} ${place.outcode}`,
    sector: place.outcode,
    city: (centre ?? place).city,
    latitude: centre?.lat ?? place.lat,
    longitude: centre?.lng ?? place.lng,
  };
  // Two first-ever lookups for the same outward code can race; the unique
  // sector decides, and the loser reads the winner's row.
  return prisma.hub.upsert({ where: { sector: place.outcode }, create: data, update: {} });
}

/**
 * Coordinates for any hub still missing them (the original hubs, created
 * before locations were geocoded). Cheap once done; best effort always.
 */
export async function backfillHubCoordinates(): Promise<void> {
  const missing = await prisma.hub.findMany({ where: { latitude: null }, take: 20 }).catch(() => []);
  await Promise.all(
    missing.map(async (hub) => {
      const centre = await lookupOutcode(hub.sector);
      if (centre) {
        await prisma.hub
          .update({ where: { id: hub.id }, data: { latitude: centre.lat, longitude: centre.lng } })
          .catch(() => undefined);
      }
    }),
  );
}
