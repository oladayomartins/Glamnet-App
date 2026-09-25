import { NextResponse } from "next/server";
import { autocompletePostcodes, lookupOutcode, searchPlaces } from "@/lib/server/geo";
import { outwardCode } from "@/lib/domain/postcode";

interface LocationSuggestion {
  kind: "postcode" | "place";
  /** What the field shows once picked: "DA1 1AA" or "Dartford". */
  label: string;
  /** Second line: "Postcode" or the county. */
  detail: string;
  /** What to resolve to a hub with /api/geo/lookup. */
  lookup: string;
}

/**
 * GET /api/geo/suggest?q=dartf — towns and postcodes for the "Where" box.
 *
 * Anything with a digit in it reads as a postcode; plain words as a place
 * name. A short run of letters ("LS") could be either: towns win, and
 * postcodes are offered only when no town starts that way.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const hasDigit = /\d/.test(q);
  const couldBePostcode = /^[a-z]{1,2}\d?[a-z\d]?(\s*\d[a-z]{0,2})?$/i.test(q);
  // A whole outward code typed alone ("DA1") is a fine answer by itself, and
  // better than a list of DA10 postcodes that merely start with the letters.
  const typedOutcode = hasDigit && !q.includes(" ") ? outwardCode(q) : null;
  const exactOutcode = typedOutcode && typedOutcode === q.toUpperCase() ? typedOutcode : null;

  const [area, postcodes, places] = await Promise.all([
    exactOutcode ? lookupOutcode(exactOutcode) : Promise.resolve(null),
    couldBePostcode && hasDigit && !exactOutcode ? autocompletePostcodes(q) : Promise.resolve([]),
    hasDigit ? Promise.resolve([]) : searchPlaces(q),
  ]);

  const suggestions: LocationSuggestion[] = [];
  if (area) {
    suggestions.push({ kind: "postcode", label: area.outcode, detail: `${area.city} · whole area`, lookup: area.outcode });
  }
  for (const postcode of postcodes) {
    suggestions.push({ kind: "postcode", label: postcode, detail: "Postcode", lookup: postcode });
  }
  // Letters alone ("LS", "DA") read as a town first; postcodes only if no
  // town starts that way.
  if (!hasDigit && couldBePostcode && places.length === 0) {
    for (const postcode of await autocompletePostcodes(q)) {
      suggestions.push({ kind: "postcode", label: postcode, detail: "Postcode", lookup: postcode });
    }
  }
  for (const place of places) {
    suggestions.push({ kind: "place", label: place.name, detail: place.detail, lookup: place.outcode });
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 8) }, { headers: { "cache-control": "public, max-age=86400" } });
}
