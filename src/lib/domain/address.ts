/**
 * Street-address suggestions, the pure part (the lookup is in
 * lib/server/geo.ts). Addresses come from OpenStreetMap, which is free but
 * patchy for UK homes: some streets list every door, most list only the
 * street. So a suggestion is either a whole first line ("21 Dover Road") or
 * a street to put a house number in front of ("Dover Road").
 */

export interface AddressSuggestion {
  /** The first line of the address: "21 Dover Road", "York Villas, Bristol Road". */
  line: string;
  /** "street" when the house number is still to be added. */
  kind: "house" | "street";
}

/** The fields of a Photon (OpenStreetMap) feature that make an address. */
export interface PhotonProperties {
  type?: string;
  housenumber?: string;
  name?: string;
  street?: string;
}

/** A Photon feature → a first address line, or null if it isn't one. */
export function toSuggestion(properties: PhotonProperties): AddressSuggestion | null {
  const { type, housenumber, name, street } = properties;
  if (type === "street") return name ? { line: name, kind: "street" } : null;
  if (type !== "house" || !street) return null;
  if (housenumber) return { line: `${housenumber} ${street}`, kind: "house" };
  // A named building with no number: "York Villas, Bristol Road".
  return name ? { line: `${name}, ${street}`, kind: "house" } : null;
}

/** Drops repeats (one street often comes back once per stretch of road). */
export function uniqueSuggestions(list: Array<AddressSuggestion | null>, limit = 8): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const item of list) {
    if (!item) continue;
    const key = item.line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * What the street box should hold once a suggestion is picked. A street
 * keeps whatever number or flat was typed before it: "Flat 2, 14 dov" +
 * "Dover Road" → "Flat 2, 14 Dover Road".
 */
export function applySuggestion(typed: string, suggestion: AddressSuggestion): string {
  if (suggestion.kind === "house") return suggestion.line;
  const { number } = splitNumber(typed);
  return number ? `${number} ${suggestion.line}` : suggestion.line;
}

/**
 * The house or flat number typed so far, and the street after it:
 * "Flat 2, 14a dov" → { number: "Flat 2, 14a", street: "dov" }. The street
 * part is what to search for when the number itself matches nothing.
 */
export function splitNumber(typed: string): { number: string; street: string } {
  const match = typed.match(/^(.*\d+[A-Za-z]?)\s+(.*)$/);
  return match ? { number: match[1], street: match[2].trim() } : { number: "", street: typed.trim() };
}

/** The part of what was typed worth searching for: "14 dov" → "14 dov". */
export function searchText(typed: string): string {
  return typed.replace(/\s+/g, " ").trim().slice(0, 80);
}
