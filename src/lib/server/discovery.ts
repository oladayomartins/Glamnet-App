import { prisma } from "./prisma";
import {
  TOP_RATED_MIN_RATING,
  TOP_RATED_MIN_REVIEWS,
} from "@/lib/domain/reputation";
import type { DiscoveryRowKey } from "@/lib/domain/discovery-rows";

/**
 * The homepage's discovery rows.
 *
 * Every row here answers a question with a query, not a guess. Nothing is
 * hand-curated, nothing is weighted by what a vendor paid, and a row whose
 * query comes back short is dropped by qualifyingRows rather than padded.
 */

/** Only vendors a customer could actually book right now. */
const LIVE = {
  approvalStatus: "APPROVED",
  isVerified: true,
  isAcceptingWork: true,
  slug: { not: null },
} as const;

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
  rating: true,
  completedBookings: true,
  workspaceSector: true,
  hub: { select: { city: true, sector: true } },
} as const;

export interface DiscoveryVendor {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string;
  city: string;
  sector: string;
  /** Null when there is nothing honest to show — see reputation.ts. */
  rating: number | null;
  reviewCount: number;
}

/** How recently a vendor must have been approved to count as new. */
const NEW_WINDOW_DAYS = 60;
/** The window "Booked this week" actually measures. */
const TRENDING_WINDOW_DAYS = 7;
/** Bookings a vendor needs before they are one of the week's busiest. */
const TRENDING_MIN_BOOKINGS = 2;

function shape(
  provider: {
    id: string;
    slug: string | null;
    name: string;
    avatarUrl: string;
    rating: number;
    workspaceSector: string;
    hub: { city: string; sector: string };
  },
  reviewCount: number,
): DiscoveryVendor {
  return {
    id: provider.id,
    slug: provider.slug ?? "",
    name: provider.name,
    avatarUrl: provider.avatarUrl,
    city: provider.hub.city,
    sector: provider.workspaceSector || provider.hub.sector,
    // The same rule the storefront follows: no score until someone gave one.
    rating: reviewCount > 0 ? provider.rating : null,
    reviewCount,
  };
}

/**
 * Recently vetted vendors.
 *
 * This row exists for them rather than for the customer: a vendor with no
 * reviews has no other route to a first booking, and "newly vetted" is a true
 * thing to say. Ordered newest first, and bounded by a window so a quiet
 * marketplace does not describe a vendor approved last spring as new.
 */
export async function newVendors(limit = 8): Promise<DiscoveryVendor[]> {
  const since = new Date(Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1_000);
  const providers = await prisma.provider.findMany({
    where: { ...LIVE, approvedAt: { gte: since } },
    orderBy: { approvedAt: "desc" },
    take: limit,
    select: {
      ...CARD_SELECT,
      _count: { select: { bookings: { where: { rating: { not: null } } } } },
    },
  });
  return providers.map((provider) => shape(provider, provider._count.bookings));
}

/**
 * Vendors whose rating is backed by enough reviews to mean something.
 *
 * Both thresholds come from the reputation module rather than being restated
 * here, so "Top rated" on the homepage and the Top rated badge on a storefront
 * can never disagree about what the phrase means.
 */
export async function topRatedVendors(limit = 8): Promise<DiscoveryVendor[]> {
  const providers = await prisma.provider.findMany({
    where: { ...LIVE, rating: { gte: TOP_RATED_MIN_RATING } },
    orderBy: [{ rating: "desc" }, { completedBookings: "desc" }],
    // Over-fetch: the review-count floor is applied below, in code, because it
    // counts rated bookings rather than a column the query can filter on.
    take: limit * 4,
    select: {
      ...CARD_SELECT,
      _count: { select: { bookings: { where: { rating: { not: null } } } } },
    },
  });

  return providers
    .filter((provider) => provider._count.bookings >= TOP_RATED_MIN_REVIEWS)
    .slice(0, limit)
    .map((provider) => shape(provider, provider._count.bookings));
}

/**
 * The week's busiest vendors, by bookings actually placed.
 *
 * Counted from bookings rather than page views: a view is noise a vendor can
 * manufacture, and a booking is the thing the row is claiming. Vendors below
 * the floor are dropped, so one booking never reads as being in demand.
 */
export async function busyVendors(limit = 8): Promise<DiscoveryVendor[]> {
  const since = new Date(
    Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1_000,
  );

  const counts = await prisma.booking.groupBy({
    by: ["providerId"],
    where: { providerId: { not: null }, bookingCreatedAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { providerId: "desc" } },
    take: limit * 4,
  });

  const ranked = counts.filter(
    (row) => row._count._all >= TRENDING_MIN_BOOKINGS,
  );
  const ids = ranked
    .map((row) => row.providerId)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  const providers = await prisma.provider.findMany({
    where: { ...LIVE, id: { in: ids } },
    select: {
      ...CARD_SELECT,
      _count: { select: { bookings: { where: { rating: { not: null } } } } },
    },
  });

  // Restore the booking-count order the groupBy produced: findMany does not
  // preserve the order of an `in` list, so without this the row would be
  // "some busy vendors" in whatever order Postgres returned them.
  const rank = new Map(ids.map((id, index) => [id, index]));
  return providers
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .slice(0, limit)
    .map((provider) => shape(provider, provider._count.bookings));
}

/** Everything the homepage needs, in one round of queries. */
export async function discoveryVendors(): Promise<
  Partial<Record<DiscoveryRowKey, DiscoveryVendor[]>>
> {
  const [fresh, top, busy] = await Promise.all([
    newVendors(),
    topRatedVendors(),
    busyVendors(),
  ]);
  return { new: fresh, topRated: top, trending: busy };
}
