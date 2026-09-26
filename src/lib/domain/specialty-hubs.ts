/**
 * The five Specialty Hubs of the marketplace directory (Open Marketplace
 * Directory §A).
 *
 * A Specialty Hub is a *category* of work, stored as `Service.category`. It is
 * not the geographic Beauty Hub (the `Hub` model), which is a sector a vendor
 * covers. The name is what is stored in the database; the slug is what
 * appears in a URL.
 */

export interface SpecialtyHub {
  slug: string;
  /** Exactly the value stored in `Service.category`. */
  name: string;
  emoji: string;
  blurb: string;
}

export const SPECIALTY_HUBS: readonly SpecialtyHub[] = [
  {
    slug: "afro-textured",
    name: "Afro & Textured",
    emoji: "🌍",
    blurb: "Braids, twists and protective styling",
  },
  {
    slug: "european-western",
    name: "European & Western",
    emoji: "👱‍♀️",
    blurb: "Blow-dries, technical updos and curls",
  },
  {
    slug: "mua-bridal",
    name: "MUA Glam & Asian Bridal",
    emoji: "👑",
    blurb: "Cosmetics, bridal looks and traditional gele ties",
  },
  {
    slug: "nails",
    name: "Manicures & Pedicures",
    emoji: "💅",
    blurb: "Gel, BIAB and nail overlays",
  },
  {
    slug: "massage-wellness",
    name: "Massage & Wellness",
    emoji: "💆‍♀️",
    blurb: "Deep tissue, sports and therapeutic massage",
  },
];

export const MUA_BRIDAL_HUB = "MUA Glam & Asian Bridal";
export const NAILS_HUB = "Manicures & Pedicures";

export function hubBySlug(slug: string): SpecialtyHub | null {
  return SPECIALTY_HUBS.find((hub) => hub.slug === slug) ?? null;
}

export function hubByName(name: string): SpecialtyHub | null {
  return SPECIALTY_HUBS.find((hub) => hub.name === name) ?? null;
}

export interface CrossSellCandidate {
  id: string;
  name: string;
  category: string;
  priceMinor: number;
  durationMinutes: number;
}

/** Words that mark a nail service as a quick, dry overlay rather than a soak. */
const DRY_TREATMENT = /\b(dry|overlay|biab|gel)\b/i;
/** A removal or soak is prep work, never the finishing overlay. */
const WET_WORK = /\b(removal|soak)\b/i;

function isDryTreatment(name: string): boolean {
  return DRY_TREATMENT.test(name) && !WET_WORK.test(name);
}

/**
 * The in-basket cross-sell (Directory §A).
 *
 * When the basket holds anything from the MUA Glam & Asian Bridal hub and no
 * nail work yet, recommend the matching dry-treatment nail overlays so a
 * bridal client can finish the look in the same appointment. Anything else
 * returns nothing — the slider only appears when it is relevant.
 *
 * Dry-treatment matches come first, then any other nail service, cheapest
 * first within each group; at most `limit` are returned.
 */
export function crossSellFor(
  basketCategories: readonly string[],
  candidates: readonly CrossSellCandidate[],
  basketIds: readonly string[] = [],
  limit = 4,
): CrossSellCandidate[] {
  const hasBridal = basketCategories.includes(MUA_BRIDAL_HUB);
  const hasNails = basketCategories.includes(NAILS_HUB);
  if (!hasBridal || hasNails) return [];

  return candidates
    .filter(
      (candidate) =>
        candidate.category === NAILS_HUB && !basketIds.includes(candidate.id),
    )
    .sort(
      (a, b) =>
        Number(isDryTreatment(b.name)) - Number(isDryTreatment(a.name)) ||
        a.priceMinor - b.priceMinor,
    )
    .slice(0, limit);
}

/**
 * Short customer-facing groups for a storefront's category buttons. Two hair
 * hubs become one "Hair": a customer choosing a service thinks "hair", not
 * which tradition the stylist works in.
 */
const MENU_GROUPS: Record<string, string> = {
  "Afro & Textured": "Hair",
  "European & Western": "Hair",
  [MUA_BRIDAL_HUB]: "Makeup",
  [NAILS_HUB]: "Nails",
  "Massage & Wellness": "Massage",
};

/** The storefront group a Service.category belongs to; unknown ones stand alone. */
export function menuGroup(category: string): string {
  return MENU_GROUPS[category] ?? category;
}

/** The groups a menu covers, in menu order, each once. */
export function menuGroups(categories: readonly string[]): string[] {
  return [...new Set(categories.map(menuGroup))];
}
