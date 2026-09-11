import Link from "next/link";
import { MapPinArea } from "@phosphor-icons/react/dist/ssr";
import {
  nearestCoveredArea,
  searchProviders,
  searchableAreas,
} from "@/lib/server/search";
import { EmptyState } from "@/components/ui";
import {
  ProviderCard,
  ProviderGrid,
  type ProviderCardData,
} from "@/components/provider-card";
import { SearchFilters } from "@/components/search-filters";

export const dynamic = "force-dynamic";

/**
 * Category & search results (§C-02).
 *
 * Results are provider cards, identical to the home page's — a customer is
 * choosing who comes to their door, so the unit of a result is a person, not a
 * catalogue row. Each card leads into the booking flow at that provider's hub
 * with the matched service pre-selected, which keeps search feeding the
 * broadcast rather than replacing it: the customer still gets the top-five
 * broadcast, not a direct assignment to whoever they tapped.
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
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const location = params.location ?? "";
  const maxPrice = params.maxPrice ?? "";
  const minRating = params.minRating ?? "";
  const availableToday = params.availableToday === "1";

  const [results, areas] = await Promise.all([
    searchProviders({
      query: q,
      location,
      maxPriceMinor: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      availableToday,
    }),
    searchableAreas(),
  ]);

  const cards: ProviderCardData[] = results.map((provider) => ({
    id: provider.id,
    name: provider.name,
    // The card names a person, so it opens that person's profile — not a hub
    // booking form with their name nowhere on it.
    href: `/providers/${provider.id}`,
    rating: provider.rating,
    reviewCount: provider.reviewCount,
    city: provider.city,
    sector: provider.sector,
    fromMinor: provider.fromMinor,
    travelFeeMinor: provider.travelFeeMinor,
    vetted: provider.vetted,
    freeTonight: provider.freeTonight,
    specialities: provider.specialities,
  }));

  const nearest = cards.length === 0 ? await nearestCoveredArea(location) : null;
  const cities = [...new Set(areas.map((area) => area.city))].sort();

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          {q ? `“${q}”` : "All providers"}
          {location ? ` in ${location}` : ""}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted" data-numeric>
          {cards.length} {cards.length === 1 ? "provider" : "providers"} can take
          this work
        </p>
      </div>

      <SearchFilters
        cities={cities}
        initial={{ q, location, maxPrice, minRating, availableToday }}
      />

      <div className="pt-5">
        {cards.length === 0 ? (
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
                  Become our first provider here
                </Link>
              )
            }
          >
            No vetted provider matches{q ? ` “${q}”` : ""}
            {location ? ` in ${location}` : ""} with these filters.
            {nearest ? ` ${nearest.city} is the nearest sector we cover.` : ""}
          </EmptyState>
        ) : (
          <ProviderGrid>
            {cards.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </ProviderGrid>
        )}
      </div>
    </div>
  );
}
