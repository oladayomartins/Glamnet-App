import Link from "next/link";
import { MapPinArea } from "@phosphor-icons/react/dist/ssr";
import { nearestCoveredArea, searchableAreas } from "@/lib/server/search";
import { searchOffers } from "@/lib/server/offers";
import { EmptyState } from "@/components/ui";
import { OfferList, type OfferRow } from "@/components/offer-list";
import { SearchFilters } from "@/components/search-filters";

export const dynamic = "force-dynamic";

/**
 * Category & search results (§C-02).
 *
 * Results are offers to choose between, not a directory to browse: one person,
 * one real start time, and the price that time actually costs, sorted by who
 * can come soonest. Every figure is computed server-side by the same pricing
 * engine the booking uses, so a row inside the emergency window shows its
 * surcharge here rather than surprising the customer at checkout.
 *
 * Choosing a row still opens the builder rather than assigning that vendor.
 * Search feeds the broadcast; it does not replace it — the customer gets the
 * top-five broadcast, not a direct assignment to whoever they tapped, which is
 * what the matching engine guarantees and what the profile page says too.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    location?: string;
    maxPrice?: string;
    minRating?: string;
    availableToday?: string;
    date?: string;
    at?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const location = params.location ?? "";
  const maxPrice = params.maxPrice ?? "";
  const minRating = params.minRating ?? "";
  const availableToday = params.availableToday === "1";
  const date = params.date ?? "";
  const at = params.at ?? "";

  const [offers, areas] = await Promise.all([
    searchOffers({
      query: q,
      location,
      maxPriceMinor: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      availableToday,
      date: date || undefined,
      at: at || undefined,
    }),
    searchableAreas(),
  ]);

  const rows: OfferRow[] = offers.map((offer) => ({
    providerId: offer.providerId,
    providerName: offer.providerName,
    avatarUrl: offer.avatarUrl,
    rating: offer.rating,
    reviewCount: offer.reviewCount,
    city: offer.city,
    sector: offer.sector,
    serviceId: offer.serviceId,
    serviceName: offer.serviceName,
    durationMinutes: offer.durationMinutes,
    reservedMinutes: offer.reservedMinutes,
    hubId: offer.hubId,
    startAt: offer.startAt.toISOString(),
    bookingType: offer.bookingType,
    totalMinor: offer.totalMinor,
    emergencySurchargeMinor: offer.emergencySurchargeMinor,
  }));

  const nearest = rows.length === 0 ? await nearestCoveredArea(location) : null;
  const cities = [...new Set(areas.map((area) => area.city))].sort();

  return (
    <div data-page-width="wide">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          {q ? `“${q}”` : "All vendors"}
          {location ? ` in ${location}` : ""}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted" data-numeric>
          {rows.length} {rows.length === 1 ? "provider" : "providers"} can take
          this work, soonest first
        </p>
      </div>

      <SearchFilters
        cities={cities}
        initial={{ q, location, maxPrice, minRating, availableToday }}
      />

      <div className="pt-5">
        {rows.length === 0 ? (
          <EmptyState
            icon={<MapPinArea size={24} weight="light" />}
            title="Nobody covers that yet"
            action={
              nearest ? (
                <Link
                  href={`/search?location=${encodeURIComponent(nearest.city)}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
                >
                  Try {nearest.city} instead
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
                >
                  Become our first vendor here
                </Link>
              )
            }
          >
            No vetted provider matches{q ? ` “${q}”` : ""}
            {location ? ` in ${location}` : ""} with these filters.
            {nearest ? ` ${nearest.city} is the nearest sector we cover.` : ""}
          </EmptyState>
        ) : (
          <OfferList offers={rows} />
        )}
      </div>
    </div>
  );
}
