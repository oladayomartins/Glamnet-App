import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, SealCheck, Star, Storefront } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { listDirectory, workspaceLabel } from "@/lib/server/storefront";
import { listCategories } from "@/lib/server/categories";
import { getSessionUser } from "@/lib/auth/session";
import { AdSlot } from "@/components/ad-slot";
import { CampaignBanner } from "@/components/campaign-banner";
import { normaliseSector } from "@/lib/domain/postcode";
import { GlamImage } from "@/components/glam-image";
import { EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { SectorFilter } from "./sector-filter";

export const dynamic = "force-dynamic";

type Params = Promise<{ city: string }>;

/** The city as it is stored on the Hub, or null if we do not operate there. */
async function resolveCity(slug: string): Promise<string | null> {
  const hub = await prisma.hub.findFirst({
    where: { city: { equals: slug.replace(/-/g, " "), mode: "insensitive" } },
    select: { city: true },
  });
  return hub?.city ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await resolveCity(slug);
  return city
    ? {
        title: `Beauty salons in ${city}`,
        description: `Home salons, private rooms and independent chairs across ${city}, sorted by postcode.`,
      }
    : { title: "Not found" };
}

/**
 * The open marketplace directory (Directory §A): /sheffield/salons.
 *
 * The Specialty Hub tiles (managed in the admin console) filter the grid; a postcode sector (typed or
 * geolocated) sorts it nearest-first. Everything is in the URL, so a filtered
 * view can be shared and the back button behaves.
 */
export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ hub?: string; sector?: string }>;
}) {
  const [{ city: citySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) notFound();

  const [categories, viewer] = await Promise.all([listCategories(), getSessionUser()]);
  const hub = query.hub ? (categories.find((category) => category.slug === query.hub) ?? null) : null;
  const sector = query.sector ? normaliseSector(query.sector) : null;
  const vendors = await listDirectory({ city, hubName: hub?.name, sector });

  const hrefWith = (next: { hub?: string | null; sector?: string | null }) => {
    const search = new URLSearchParams();
    const hubValue = next.hub === undefined ? hub?.slug : next.hub;
    const sectorValue = next.sector === undefined ? sector : next.sector;
    if (hubValue) search.set("hub", hubValue);
    if (sectorValue) search.set("sector", sectorValue);
    const text = search.toString();
    return `/${citySlug}/salons${text ? `?${text}` : ""}`;
  };

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">
          Open marketplace · {city}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
          {hub ? hub.name : "Every salon, chair and studio"}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          Verified independents across {city}. Choose a hub, add your postcode, and book the
          person you actually want.
        </p>
      </header>

      <CampaignBanner viewer={viewer?.role ?? null} />

      {/* --- The category hub grid (admins manage the list) -------------- */}
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
              <span className="mt-2 block font-display text-[15px] font-bold leading-tight">
                {tile.name}
              </span>
              <span className={`mt-1 block text-xs ${active ? "text-metal-ink/80" : "text-ink-muted"}`}>
                {tile.blurb}
              </span>
            </Link>
          );
        })}
      </nav>

      <SectorFilter current={sector} basePath={`/${citySlug}/salons`} hub={hub?.slug ?? null} />

      <AdSlot slot="DIRECTORY_TOP" />

      {vendors.length === 0 ? (
        <EmptyState icon={<Storefront size={24} weight="light" />} title="Nobody here yet">
          No verified vendors in this hub yet.{" "}
          <Link href={hrefWith({ hub: null })} className="font-semibold text-accent-700">
            See every hub
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      {vendor.distanceKm === 0 ? `In ${vendor.sector}` : `${vendor.distanceKm.toFixed(1)} km`}
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
      )}
    </div>
  );
}
