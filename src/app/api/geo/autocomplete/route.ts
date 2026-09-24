import { NextResponse } from "next/server";
import { autocompletePostcodes } from "@/lib/server/geo";

/** GET /api/geo/autocomplete?q=S10 — postcodes beginning with what was typed. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 10);
  const postcodes = await autocompletePostcodes(q);
  return NextResponse.json({ postcodes }, { headers: { "cache-control": "public, max-age=86400" } });
}
