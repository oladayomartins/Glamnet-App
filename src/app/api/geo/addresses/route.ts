import { NextResponse } from "next/server";
import { suggestAddresses } from "@/lib/server/geo";

/**
 * GET /api/geo/addresses?q=14 dov&lat=…&lng=… — first address lines near a
 * postcode that was already looked up, for the street box.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const inUk = lat > 49 && lat < 61.5 && lng > -8.8 && lng < 2.1;
  const suggestions = inUk ? await suggestAddresses((params.get("q") ?? "").slice(0, 80), { lat, lng }) : [];
  return NextResponse.json({ suggestions }, { headers: { "cache-control": "public, max-age=86400" } });
}
