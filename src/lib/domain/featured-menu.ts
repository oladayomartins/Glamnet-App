

/**
 * How much of a long service menu to show before "See all".
 *
 * A vendor with twenty services pushes their reviews, hours and everything
 * else below three screens of scrolling. Showing a handful first keeps the
 * page the length of a decision rather than the length of a catalogue.
 *
 * Which handful matters, though. A menu truncated to whatever happens to sort
 * first will cut a vendor's signature service in favour of an alphabetical
 * accident, so a vendor can pin the ones they want seen. Without pins the
 * fallback is the cheapest — the entry point, the thing a new client is most
 * likely to book first — rather than the first row of an arbitrary sort.
 */

export const FEATURED_LIMIT = 4;

export interface FeaturableService {
  id: string;
  kind: string;
  priceMinor: number;
  isFeatured?: boolean;
}

export interface FeaturedMenu<T> {
  /** What to show before the customer asks for more. */
  featured: T[];
  /** Everything, for when they do. */
  all: T[];
  /** How many are hidden behind "See all". Zero means show no such control. */
  hiddenCount: number;
  /** True when the vendor chose these rather than the fallback picking them. */
  pinned: boolean;
}

/**
 * Split a menu into what leads and what waits.
 *
 * Add-ons never lead: nobody books a lash application on its own, so one
 * appearing among the first four would waste a slot that a bookable service
 * should have had.
 */
export function featuredMenu<T extends FeaturableService>(
  services: readonly T[],
  limit = FEATURED_LIMIT,
): FeaturedMenu<T> {
  const bookable = services.filter((service) => service.kind !== "ADDON");
  const pinnedItems = bookable.filter((service) => service.isFeatured);

  // A vendor who pinned more than the limit still gets all their pins: they
  // asked for them, and silently dropping the fifth would be a worse surprise
  // than a slightly longer list.
  const featured =
    pinnedItems.length > 0
      ? pinnedItems
      : [...bookable]
          .sort((a, b) => a.priceMinor - b.priceMinor)
          .slice(0, limit);

  return {
    featured,
    all: [...services],
    // Counted against the whole menu, add-ons included: "See all 12" has to
    // match what the customer finds when they tap it.
    hiddenCount: Math.max(0, services.length - featured.length),
    pinned: pinnedItems.length > 0,
  };
}
