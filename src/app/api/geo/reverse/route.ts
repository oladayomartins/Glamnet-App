import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/server/geo";

/**
 * GET /api/geo/reverse?lat=…&lng=… — the postcode nearest the browser's
 * location, for "Use my location". The coordinates are not stored.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const inUk = lat > 49 && lat < 61.5 && lng > -8.8 && lng < 2.1;
  const place = inUk ? await reverseGeocode({ lat, lng }) : null;
  if (!place) {
    return NextResponse.json(
      { error: { code: "OUTSIDE_UK", message: "We couldn't find a UK postcode where you are. Type yours instead." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ place }, { headers: { "cache-control": "private, no-store" } });
}
