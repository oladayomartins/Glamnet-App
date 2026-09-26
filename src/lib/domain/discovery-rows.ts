/**
 * Which discovery rows a marketplace is entitled to show.
 *
 * The rows themselves — New to GLAMNET, Top rated, Trending — are cheap. What
 * is not cheap is showing one that is not true. A "Trending" rail over three
 * vendors nobody has booked is the same mistake as a made-up "47,582
 * appointments booked today": it costs nothing to print and everything to be
 * caught printing.
 *
 * So each row states what it needs, and a row that cannot meet it is not
 * rendered at all — not rendered empty, not rendered with a placeholder. The
 * homepage grows rows as the marketplace earns them.
 */

export type DiscoveryRowKey = "new" | "topRated" | "trending";

export interface DiscoveryRowSpec {
  key: DiscoveryRowKey;
  title: string;
  lede: string;
  /**
   * Vendors needed before the row is worth a whole rail. Below this the row
   * reads as a marketplace pretending to have depth it does not have.
   */
  minimumVendors: number;
}

export const DISCOVERY_ROWS: DiscoveryRowSpec[] = [
  {
    key: "new",
    title: "New to GLAMNET",
    // The point of this row: a vendor with no reviews yet has no other way to
    // be seen, and "newly vetted" is a true thing to say about them.
    lede: "Just vetted and taking bookings.",
    minimumVendors: 2,
  },
  {
    key: "topRated",
    title: "Top rated",
    lede: "Consistently rated by clients who have actually been.",
    minimumVendors: 3,
  },
  {
    key: "trending",
    title: "Booked this week",
    // Deliberately not "Trending". Trending implies a trend — a direction over
    // time — which a count of recent bookings is not. "Booked this week" is
    // exactly what the number means.
    lede: "Most booked in the last seven days.",
    minimumVendors: 3,
  },
];

export interface DiscoveryRow<T> {
  spec: DiscoveryRowSpec;
  vendors: T[];
}

/**
 * Keep the rows that have earned their place, in catalogue order.
 *
 * `available` is what each query actually returned. A row missing from it
 * entirely — because the query was never run, or returned nothing — is simply
 * absent, which is the same outcome as failing the minimum.
 */
export function qualifyingRows<T>(
  available: Partial<Record<DiscoveryRowKey, T[]>>,
): DiscoveryRow<T>[] {
  return DISCOVERY_ROWS.map((spec) => ({
    spec,
    vendors: available[spec.key] ?? [],
  })).filter((row) => row.vendors.length >= row.spec.minimumVendors);
}
