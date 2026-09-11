import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Hand,
  Heart,
  MagnifyingGlass,
  PaintBrush,
  Receipt,
  Scissors,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import { getPricingContext } from "@/lib/server/emergency-config";
import { getMarketingData } from "@/lib/server/marketing";
import { BlockHeading } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";
import { FeaturedProviders } from "@/components/featured-providers";
import type { ProviderCardData } from "@/components/provider-card";

export const dynamic = "force-dynamic";

/**
 * Category icons. Phosphor, Light weight at 20px — the whole icon set is one
 * stroke width, so a category we have not drawn for falls back to the generic
 * tile icon rather than borrowing a heavier mark from somewhere else.
 */
const CATEGORY_ICONS: Record<string, ReactNode> = {
  Hair: <Scissors size={20} weight="light" />,
  Makeup: <PaintBrush size={20} weight="light" />,
  Nails: <Hand size={20} weight="light" />,
  Skin: <Heart size={20} weight="light" />,
};

/** §C-01 block 5. Three steps, in the customer's order, one line each. */
const HOW_IT_WORKS = [
  {
    icon: <MagnifyingGlass size={20} weight="light" />,
    title: "Search your sector",
    body: "You only ever see services a vetted provider can actually deliver where you are.",
  },
  {
    icon: <Receipt size={20} weight="light" />,
    title: "Compare the full price",
    body: "Every line is itemised — services, travel, any emergency rate — before you authorise a penny.",
  },
  {
    icon: <CalendarCheck size={20} weight="light" />,
    title: "Book and track",
    body: "The first matched provider to accept takes the job, and you follow them to the door.",
  },
];

/**
 * The customer home is a marketplace, not a dashboard.
 *
 * Five blocks in a fixed order — search hero, categories, featured providers,
 * cities, how it works — and then the CTA band. Each block gets at most one
 * metal element, which is why the hero's submit, the active filter chip and
 * the CTA's primary button are the only metal on the page.
 */
export default async function MarketingPage() {
  const [{ providers, categories, cities, stats }, { thresholdMinutes }] =
    await Promise.all([getMarketingData(), getPricingContext()]);

  const thresholdHours = Math.round(thresholdMinutes / 60);
  const areas = cities.map((city) => ({
    id: city.hubId,
    name: city.city,
    city: city.city,
    sector: city.sector,
  }));

  const cards: ProviderCardData[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
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

  return (
    <div className="space-y-16 pb-6 sm:space-y-20">
      {/* ================= Block 1 — search hero ====================== */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            {/* Jade means live. One breathing dot, and the words carry the
                meaning on their own if the motion is switched off. */}
            <span
              aria-hidden
              className="breathe h-2 w-2 rounded-full bg-normal"
            />
            Beauty, at your door
          </p>

          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.03] tracking-[-0.03em] text-ink sm:text-5xl">
            Book a vetted beauty
            <br />
            professional to come to you.
          </h1>

          <p className="mt-4 max-w-lg text-[15px] text-ink-muted">
            Real availability from real calendars, an itemised price before you
            pay, and someone at your door — today, if that is what you need.
          </p>

          <div className="mt-6">
            <SearchBar areas={areas} />
          </div>

          {/* Trust figures. Real counts, never rounded up. */}
          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
            <TrustFigure
              value={String(stats.providerCount)}
              label={
                stats.providerCount === 1
                  ? "Vetted provider"
                  : "Vetted providers"
              }
            />
            <TrustFigure
              value={
                stats.averageRating ? stats.averageRating.toFixed(1) : "—"
              }
              label="Average rating"
            />
            <TrustFigure
              value={`${thresholdHours}h`}
              label="Emergency cover"
            />
          </dl>
        </div>

        {/* 4:3 hero slot. Real photography drops in here; until then it holds
            its aspect ratio so the hero never reflows when it arrives. */}
        <div
          aria-hidden
          className="hidden aspect-[4/3] w-full rounded-glam-lg bg-metal shadow-raised lg:block"
        />
      </section>

      {/* ================= Block 2 — service categories ================ */}
      {categories.length > 0 ? (
        <section>
          <BlockHeading
            title="Browse service categories"
            lede="Every category below has a provider behind it right now."
          />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(138px,1fr))]">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/search?q=${encodeURIComponent(category.name)}`}
                className="flex min-h-[118px] flex-col justify-between rounded-glam border border-line bg-surface p-4 shadow-card transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:shadow-raised"
              >
                <span className="text-brand-700" aria-hidden>
                  {CATEGORY_ICONS[category.name] ?? (
                    <SquaresFour size={20} weight="light" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {category.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {category.providerCount}{" "}
                    {category.providerCount === 1 ? "provider" : "providers"}
                  </span>
                </span>
              </Link>
            ))}

            {/* The last tile is the way out of the grid, in the rose tint. */}
            <Link
              href="/search"
              className="flex min-h-[118px] flex-col justify-between rounded-glam border border-brand-200 bg-brand-50 p-4 transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="text-brand-700" aria-hidden>
                <SquaresFour size={20} weight="light" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-brand-700">
                  All categories
                </span>
                <span className="mt-0.5 block text-xs text-brand-700/80">
                  {stats.serviceCount} services
                </span>
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* ================= Block 3 — featured providers ================ */}
      {cards.length > 0 ? (
        <section>
          <BlockHeading
            title="Featured providers"
            lede="Ranked by rating and completed work, never by what they paid us."
            action={
              <Link
                href="/search"
                className="tap-44 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                See all
                <ArrowRight size={14} weight="light" aria-hidden />
              </Link>
            }
          />
          <FeaturedProviders
            providers={cards}
            categories={categories.map((category) => category.name)}
          />
        </section>
      ) : null}

      {/* ================= Block 4 — cities ============================ */}
      {cities.length > 0 ? (
        <section>
          <BlockHeading title="Browse by city" />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {cities.slice(0, 6).map((city) => (
              <Link
                key={city.city}
                href={`/search?location=${encodeURIComponent(city.city)}`}
                className="group overflow-hidden rounded-glam border border-line bg-surface shadow-card transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div aria-hidden className="aspect-[16/10] w-full bg-metal" />
                <div className="p-3.5">
                  <p className="text-sm font-semibold text-ink">{city.city}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {city.providerCount}{" "}
                    {city.providerCount === 1 ? "provider" : "providers"} ·{" "}
                    {city.sector}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ================= Block 5 — how it works ====================== */}
      <section>
        <BlockHeading title="How it works" />
        <ol className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {HOW_IT_WORKS.map((step, index) => (
            <li
              key={step.title}
              className="overflow-hidden rounded-glam border border-line bg-surface shadow-card"
            >
              <div className="relative aspect-[16/10] w-full bg-sunken">
                {/* The badge overlaps the bottom-left of the image, half in
                    and half out — the one metal element in this block. */}
                <span
                  aria-hidden
                  className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-metal text-metal-ink shadow-card"
                >
                  {step.icon}
                </span>
              </div>
              <div className="px-4 pb-4 pt-8">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                  Step 0{index + 1}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[15px] text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= CTA band ==================================== */}
      <section className="overflow-hidden rounded-glam-lg border border-line bg-surface shadow-card">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
              Bring your next occasion to life
            </h2>
            <p className="mt-3 max-w-lg text-[15px] text-ink-muted">
              Whether you need someone this evening or you want to take bookings
              of your own, it starts in the same place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/search"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam active:scale-[0.98]"
              >
                Find a provider
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-sunken active:scale-[0.98]"
              >
                Become a provider
              </Link>
            </div>
          </div>

          {/* Overlapping avatar stack. The faces are placeholders, but the
              overflow chip is not a decorative "+2k": it counts the providers
              the stack could not show. A marketplace that inflates its own
              numbers here is contradicted by the search page one click away. */}
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex -space-x-3">
              {Array.from({
                length: Math.min(4, stats.providerCount),
              }).map((_, index) => (
                <span
                  key={index}
                  className="h-10 w-10 rounded-full bg-metal ring-2 ring-surface"
                />
              ))}
              {stats.providerCount > 4 ? (
                <span className="flex h-10 items-center rounded-full bg-sunken px-3 font-mono text-xs font-semibold text-ink ring-2 ring-surface">
                  +{stats.providerCount - 4}
                </span>
              ) : null}
            </span>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">
                {stats.providerCount}
              </span>{" "}
              vetted{" "}
              {stats.providerCount === 1 ? "provider" : "providers"} taking work
              across {stats.cityCount}{" "}
              {stats.cityCount === 1 ? "city" : "cities"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A hero trust figure: champagne number, muted label. */
function TrustFigure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span
          data-numeric
          className="block font-display text-3xl font-bold tracking-[-0.02em] text-accent-700"
        >
          {value}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{label}</span>
      </dd>
    </div>
  );
}
