import Link from "next/link";
import { searchableAreas, searchServices } from "@/lib/server/search";
import { Card, EmptyState } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";
import { formatDuration, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Search results: services that someone can actually deliver near you.
 *
 * Each result leads into the existing booking flow at that provider's hub,
 * with the service pre-selected — so search feeds matching rather than
 * replacing it. The customer still gets the top-5 broadcast, not a direct
 * assignment to whoever they clicked.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string }>;
}) {
  const { q = "", location = "" } = await searchParams;
  const [results, areas] = await Promise.all([
    searchServices(q, location),
    searchableAreas(),
  ]);

  const total = results.length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-brand-700">
          ← Home
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          {q ? `“${q}”` : "All services"}
          {location ? ` in ${location}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {total} {total === 1 ? "service" : "services"} with someone available
        </p>
      </div>

      <SearchBar areas={areas} initialQuery={q} initialLocation={location} />

      {total === 0 ? (
        <EmptyState>
          Nothing matched{q ? ` “${q}”` : ""}
          {location ? ` in ${location}` : ""}. Try a different service or area —
          results only include work a vetted professional can actually take.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <Card key={result.serviceId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {result.name}
                    {result.kind === "ADDON" ? (
                      <span className="ml-2 rounded-full bg-sunken px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        Add-on
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {result.description}
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {formatDuration(result.durationMinutes)} · {result.category}
                  </p>
                </div>
                <span className="font-mono text-lg font-bold text-ink">
                  {formatMoney(result.priceMinor)}
                </span>
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  Available from
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.providers.slice(0, 5).map((provider) => (
                    <Link
                      key={provider.id}
                      href={`/book/${provider.hubId}?service=${result.serviceId}`}
                      className="rounded-glam-sm border border-line px-3 py-1.5 text-sm text-ink transition hover:border-brand-400"
                    >
                      {provider.name}
                      <span className="ml-1.5 font-mono text-xs text-ink-muted">
                        {provider.rating.toFixed(1)}★ · {provider.sector}
                      </span>
                    </Link>
                  ))}
                  {result.providers.length > 5 ? (
                    <span className="self-center text-xs text-ink-muted">
                      +{result.providers.length - 5} more
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
