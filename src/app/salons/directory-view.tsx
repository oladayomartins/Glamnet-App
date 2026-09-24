import Link from "next/link";
import { MapPin, SealCheck, Star, Storefront } from "@phosphor-icons/react/dist/ssr";
import { listDirectory, workspaceLabel } from "@/lib/server/storefront";
import { listCategories } from "@/lib/server/categories";
import { backfillHubCoordinates, lookupPlace } from "@/lib/server/geo";
import { getSessionUser } from "@/lib/auth/session";
import { AdSlot } from "@/components/ad-slot";
import { CampaignBanner } from "@/components/campaign-banner";
import { GlamImage } from "@/components/glam-image";
import { EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { DEFAULT_RADIUS_MILES, RADIUS_MILES, formatMiles, milesToKm } from "@/lib/domain/postcode";
import { LocationFilter } from "./location-filter";
import { DirectoryMap } from "./directory-map";

export interface DirectoryQuery {
  hub?: string;
  near?: string;
  radius?: string;
  /** The old ?sector= links keep working. */
  sector?: string;
}

/**
 * The open marketplace directory (Directory §A), UK-wide.
 *
 * /salons covers the whole UK; /[city]/salons is the same view for one city.
 * Category tiles filter it; a postcode (typed, suggested or from the phone's
 * location) sorts it nearest first within a radius, and a map shows where
 * everyone is — by area only, never by address. Everything is in the URL.
 */
export async function DirectoryView({
  city,
  basePath,
  query,
}: {
  city: string | null;
  basePath: string;
  query: DirectoryQuery;
}) {
  // Areas created before locations were geocoded get their coordinates here,
  // the first time anyone opens the directory. A no-op once done.
  const [categories, viewer] = await Promise.all([listCategories(), getSessionUser(), backfillHubCoordinates()]);
  const hub = query.hub ? (categories.find((category) => category.slug === query.hub) ?? null) : null;

  const nearText = (query.near ?? query.sector ?? "").trim().slice(0, 10);
  const place = nearText ? await lookupPlace(nearText) : null;
  const radiusMiles = RADIUS_MILES.includes(Number(query.radius) as (typeof RADIUS_MILES)[number])
    ? Number(query.radius)
    : DEFAULT_RADIUS_MILES;

  const vendors = await listDirectory({
    city,
    hubName: hub?.name,
    near: place,
    radiusKm: place ? milesToKm(radiusMiles) : null,
  });

  const hrefWith = (next: { hub?: string | null }) => {
    const search = new URLSearchParams();
    const hubValue = next.hub === undefined ? hub?.slug : next.hub;
    if (hubValue) search.set("hub", hubValue);
    if (place) {
      search.set("near", place.postcode ?? place.outcode);
      search.set("radius", String(radiusMiles));
    }
    const text = search.toString();
    return `${basePath}${text ? `?${text}` : ""}`;
  };

  const where = place ? `near ${place.postcode ?? place.outcode}` : city ? `in ${city}` : "across the UK";

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">
          Open marketplace · {city ?? "United Kingdom"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
          {hub ? hub.name : "Every salon, chair and studio"}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          Verified independents {where}. Choose a category, add your postcode, and book the person
          you actually want.
        </p>
      </header>

      <CampaignBanner viewer={viewer?.role ?? null} />

      {/* --- Category tiles (admins manage the list) --------------------- */}
      <nav
        aria-label="Specialty hubs"
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${categories.length % 4 === 0 ? "lg:grid-cols-4" : categories.length >= 6 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
      >
        {categories.map((tile) => {
          const active = tile.slug === hub?.slug;
          return (
            <Link
              key={tile.slug}
              href={hrefWith({ hub: active ? null : tile.slug })}
              aria-current={active ? "page" : undefined}
              className={`rounded-glam border p-4 transition duration-[180ms] ease-glam ${
                active
                  ? "border-accent-500 bg-accent-500 text-metal-ink"
                  : "border-line bg-surface text-ink hover:border-accent-500"
              }`}
            >
              <span aria-hidden className="text-2xl">{tile.emoji}</span>
              <span className="mt-2 block font-display text-[15px] font-bold leading-tight">{tile.name}</span>
              <span className={`mt-1 block text-xs ${active ? "text-metal-ink/80" : "text-ink-muted"}`}>
                {tile.blurb}
              </span>
            </Link>
          );
        })}
      </nav>

      <LocationFilter
        basePath={basePath}
        hub={hub?.slug ?? null}
        near={place ? (place.postcode ?? place.outcode) : nearText || null}
        radius={radiusMiles}
      />
      {nearText && !place ? (
        <p role="alert" className="-mt-5 text-sm text-warning">
          We couldn&rsquo;t find &ldquo;{nearText}&rdquo;. Check the postcode and try again.
        </p>
      ) : null}

      <AdSlot slot="DIRECTORY_TOP" />

      {vendors.length === 0 ? (
        <EmptyState icon={<Storefront size={24} weight="light" />} title="Nobody here yet">
          {place
            ? `No verified pros within ${radiusMiles} miles of ${place.postcode ?? place.outcode} yet.`
            : "No verified pros here yet."}{" "}
          {place && radiusMiles < 25 ? (
            <Link href={`${hrefWith({})}`.replace(`radius=${radiusMiles}`, "radius=25")} className="font-semibold text-accent-700">
              Search within 25 miles
            </Link>
          ) : hub ? (
            <Link href={hrefWith({ hub: null })} className="font-semibold text-accent-700">
              See every category
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <ul className="grid gap-4 sm:grid-cols-2">
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/pro/${vendor.slug}?via=directory`}
                  className="group block overflow-hidden rounded-glam border border-line bg-surface shadow-card transition hover:border-accent-500"
                >
                  <div className="relative aspect-[4/3]">
                    <GlamImage
                      src={vendor.lookbook[0] ?? vendor.avatarUrl}
                      alt={`Work by ${vendor.name}`}
                      width={640}
                      height={480}
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="h-full w-full object-cover"
                    />
                    {vendor.isFeatured ? (
                      <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-bold text-metal-ink">
                        Featured
                      </span>
                    ) : null}
                    {vendor.distanceKm !== null ? (
                      <span data-numeric className="absolute left-3 top-3 rounded-full bg-obsidian/85 px-2.5 py-1 text-xs font-semibold text-on-obsidian">
                        {formatMiles(vendor.distanceKm)}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
                      {vendor.name}
                      <SealCheck size={16} weight="fill" className="text-accent-500" aria-label="Verified" />
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
                      <span className="flex items-center gap-1" data-numeric>
                        <Star size={13} weight="fill" className="text-accent-500" aria-hidden />
                        {vendor.rating.toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={13} aria-hidden />
                        {workspaceLabel(vendor.workspaceType)} · {vendor.sector}
                        {city ? "" : `, ${vendor.city}`}
                      </span>
                    </p>
                    <p className="mt-2 flex items-baseline justify-between text-sm">
                      <span className="truncate text-ink-muted">{vendor.hubs.join(" · ")}</span>
                      {vendor.fromMinor !== null ? (
                        <span data-numeric className="shrink-0 font-bold text-accent-700">
                          from {formatMoney(vendor.fromMinor)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="lg:sticky lg:top-24">
            <DirectoryMap
              near={place ? { lat: place.lat, lng: place.lng, label: place.postcode ?? place.outcode } : null}
              vendors={vendors.map((vendor) => ({
                id: vendor.id,
                slug: vendor.slug,
                name: vendor.name,
                sector: vendor.sector,
                area: vendor.area,
                isFeatured: vendor.isFeatured,
                priceLabel: vendor.fromMinor !== null ? `from ${formatMoney(vendor.fromMinor)}` : "",
              }))}
            />
            <p className="mt-2 text-xs text-ink-muted">
              Pins show each pro&rsquo;s area, not their address. You get the exact address once you book.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
