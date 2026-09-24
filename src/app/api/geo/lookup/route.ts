import { NextResponse } from "next/server";
import { hubForPlace, lookupPlace } from "@/lib/server/geo";

/**
 * GET /api/geo/lookup?q=S10 2HN[&hub=1] — a UK postcode or outward code to a
 * place. With hub=1 it also returns the Beauty Hub for that area, creating
 * one on first use, for the flows that book against a hub.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, 12);
  const place = await lookupPlace(q);
  if (!place) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_POSTCODE", message: "We couldn't find that postcode. Check it and try again." } },
      { status: 404 },
    );
  }
  const hub = params.get("hub") === "1" ? await hubForPlace(place) : null;
  return NextResponse.json(
    { place, hub: hub ? { id: hub.id, sector: hub.sector, city: hub.city, name: hub.name, travelFeeMinor: hub.travelFeeMinor } : null },
    { headers: { "cache-control": hub ? "private, no-store" : "public, max-age=86400" } },
  );
}
