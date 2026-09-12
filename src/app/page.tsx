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
  Lightning,
  Scissors,
  ShieldCheck,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import { getPricingContext } from "@/lib/server/emergency-config";
import { getMarketingData } from "@/lib/server/marketing";
import { BlockHeading } from "@/components/ui";
import { BookingLauncher } from "@/components/booking-launcher";
import { FeaturedProviders } from "@/components/featured-providers";
import { GlamImage } from "@/components/glam-image";
import { BrandImage } from "@/components/brand-image";
import { Rail } from "@/components/rail";
import { HERO_IMAGE_PATH, categoryImagePath } from "@/lib/imagekit";
import type { ProviderCardData } from "@/components/provider-card";

export const dynamic = "force-dynamic";

/**
 * Category icons. Phosphor, Light weight — the whole icon set is one stroke
 * width, so a category we have not drawn for falls back to the generic tile
 * icon rather than borrowing a heavier mark from somewhere else.
 */
const CATEGORY_ICONS: Record<string, ReactNode> = {
  Hair: <Scissors size={18} weight="light" />,
  Makeup: <PaintBrush size={18} weight="light" />,
  Nails: <Hand size={18} weight="light" />,
  Skin: <Heart size={18} weight="light" />,
};

/** §C-01 block 5. Three steps, in the customer's order, one line each. */
const HOW_IT_WORKS = [
  {
    icon: <MagnifyingGlass size={20} weight="light" />,
    title: "Search your sector",
    body: "You only ever see services a vetted vendor can actually deliver where you are.",
  },
  {
    icon: <Receipt size={20} weight="light" />,
    title: "Compare the full price",
    body: "Every line is itemised — services, travel, any emergency rate — before you authorise a penny.",
  },
  {
    icon: <CalendarCheck size={20} weight="light" />,
    title: "Book and track",
    body: "The first matched vendor to accept takes the job, and you follow them to the door.",
  },
];

/** The contained column every block below the hero sits in. */
function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[var(--glam-page-max)] px-4 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The customer home is a marketplace, not a dashboard.
 *
 * Five blocks in a fixed order — search hero, categories, featured vendors,
 * cities, how it works — and then the CTA band. Each block gets at most one
 * metal element, which is why the hero's submit, the active filter chip and
 * the CTA's primary button are the only metal on the page.
 *
 * The browse blocks are rails rather than wrapping grids: they are a glance,
 * not a search, and the point is to show there is more without spending four
 * rows of the page saying so. Search is where everything is, and that stays a
 * grid.
 */
export default async function MarketingPage() {
  const [
    { providers, categories, cities, searchHints, stats },
    { thresholdMinutes },
  ] =
    await Promise.all([getMarketingData(), getPricingContext()]);

  const thresholdHours = Math.round(thresholdMinutes / 60);
  const areas = cities.map((city) => ({
    hubId: city.hubId,
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
    imageUrl: provider.avatarUrl,
    freeTonight: provider.freeTonight,
    specialities: provider.specialities,
  }));

  return (
    // `full` hands the whole width to the page, which then contains its own
    // sections — so the hero can run edge to edge without a child trying to
    // break out of a container it sits inside.
    <div data-page-width="full" className="-mt-6 pb-6">
      {/* ================= Block 1 — search hero ====================== */}
      {/*
        The banner is 8:3 with the subject on the right and deliberate cream
        negative space on the left, so the copy sits in space the photograph
        already left for it. No scrim: the left third measures 227 mean
        luminance and 191 at its darkest, which puts dark ink at 7.75:1 even
        at the worst point — a black wash would only destroy the composition
        that makes that true.

        The band is a light region in both themes, so it scopes the light
        palette. Without that, dark mode would invert the copy and the search
        bar to their dark selves on top of a cream photograph.
      */}
      <section
        /*
          A floor on the band's height, and the copy centred in it. The bar's
          panels float, so the bar never changes height and this is the only
          thing deciding the crop.

          37rem is arithmetic, not taste. `cover` scales an 8:3 source to the
          band's height, so the fraction of the picture still visible is
          540 / bandHeight at a 1440 viewport: 688px showed 78% of it and cut
          the subject at the right edge, 592px shows 91% — the whole
          composition, mirror and dressing table included, which is the
          framing in the reference.
        */
        className="on-light relative bg-[var(--glam-hero-ground)] text-ink lg:flex lg:min-h-[37rem] lg:items-center"
      >
        {/*
          The photograph runs the full width of the band from `lg`, with the
          copy over the cream negative space the composition already leaves on
          the left. That is the arrangement the band was designed around; it
          was given its own 46% column for a while because the booking module
          made the band tall enough to zoom an 8:3 photograph in until the
          subject walked across the words.

          The band's HEIGHT is what governs that crop, so the height is what
          is controlled instead: an open step scrolls inside a capped panel
          rather than growing the band, and everything above is trimmed to
          keep the band near 2:1 on a desktop — about the proportion the
          picture was shot for. There is a measurement in the commit.
        */}
        {/*
          Desktop only, in two arrangements, and the switch between them is
          measured rather than chosen by eye.

          From 1400px the photograph runs the full width of the band with the
          copy over the cream negative space the composition already leaves on
          the left — the arrangement the picture was shot for. Below that it
          takes its own right-hand column instead. The reason is the crop: the
          source is 8:3, the band is about 684px tall, and `cover` therefore
          shows less and less of the source width as the viewport narrows —
          79% at 1440, 70% at 1280, 57% at 1024. Every percent lost walks the
          subject further left, into the words. Reading the pixels actually
          behind the copy gives 5.4:1 at 1440 and 3.3:1 at 1280, so 1400 is
          roughly where the full-bleed version stops being readable.

          `lazy` rather than `priority`: an eager image inside a
          `display: none` wrapper is still fetched, so priority would download
          a hero for every phone that never shows one.
        */}
        <div className="hero-picture pointer-events-none hidden lg:block">
          <BrandImage
            path={HERO_IMAGE_PATH}
            alt="A client with fresh braids and evening makeup at home"
            width={1600}
            height={600}
            sizes="(max-width: 1399px) 46vw, 100vw"
            className="h-full w-full object-cover"
          />
          {/* Column arrangement: a narrow fade so the picture's left edge is
              a join rather than a cut. */}
          <div
            aria-hidden
            className="hero-fade-edge absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--glam-hero-ground)] to-transparent"
          />
          {/*
            Full-bleed arrangement: a wash of the band's own ground colour
            across the left, gone before it reaches the subject. Not a scrim
            over the photograph — the same cream the photograph already has
            there, held steady so the copy's contrast does not depend on how
            far the crop happens to zoom at a given width.
          */}
          <div
            aria-hidden
            className="hero-fade-wash absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[var(--glam-hero-ground)] from-45% to-transparent"
          />
        </div>

        <Container className="relative pb-8 pt-9 lg:py-10 xl:py-12">
          {/*
            The copy column is wide rather than clamped to `max-w-lg`: a narrow
            column inside a full-bleed band reads as floating in the middle of
            the cream instead of sitting on the page grid. It stops short of
            the photograph's column at every width — 34rem is inside the 54%
            left half from 1024px up, and the extra 2rem at `xl` still is.
          */}
          <div className="max-w-[var(--glam-hero-col)]">
            <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              {/* Jade means live. One breathing dot, and the words carry the
                  meaning on their own if the motion is switched off. */}
              <span
                aria-hidden
                className="breathe h-2 w-2 rounded-full bg-normal"
              />
              Beauty, at your door
            </p>

            {/* 800, which is heavier than Instrument Sans could go at all —
                the reason the display family exists. */}
            <h1 className="mt-4 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[3.4rem] lg:text-[3.75rem]">
              Get glammed wherever you are
            </h1>

            <p className="mt-5 max-w-lg text-base text-ink-muted">
              Hair, beauty and makeup vendors brought to you. Real
              availability, an itemised price before you pay, and someone at
              your door — today, if that is what you need.
            </p>
          </div>

          {/*
            The bar is deliberately wider than the words above it. A measure
            that suits a headline is too narrow for a control holding a field,
            a town and a button — below `lg` those stack and the width is moot,
            and from `lg` the extra 4rem still lands on the photograph's cream
            half, well clear of the subject.
          */}
          <div className="mt-6 max-w-[var(--glam-hero-col)]">
            <BookingLauncher
              areas={areas}
              hints={searchHints}
              thresholdMinutes={thresholdMinutes}
            />
          </div>

          <div className="max-w-[34rem] xl:max-w-[38rem]">

            {/* Trust figures. Real counts, never rounded up. */}
            <dl className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
              <HeroFigure
                icon={<ShieldCheck size={15} weight="fill" aria-hidden />}
                value={String(stats.providerCount)}
                label={
                  stats.providerCount === 1
                    ? "Vetted vendor"
                    : "Vetted vendors"
                }
              />
              <HeroFigure
                icon={<Lightning size={15} weight="fill" aria-hidden />}
                value={`${thresholdHours}h`}
                label="Emergency cover"
              />
            </dl>
          </div>
        </Container>

      </section>

      {/* ================= Block 2 — service categories ================ */}
      {categories.length > 0 ? (
        <Container className="pt-14 sm:pt-16">
          <BlockHeading
            title="Browse service categories"
            lede="Every category here has a vendor behind it right now."
            action={
              <SeeAll href="/search" />
            }
          />

          <Rail label="Service categories">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/search?q=${encodeURIComponent(category.name)}`}
                className="group w-[180px] shrink-0 snap-start sm:w-[210px]"
              >
                <span className="relative block overflow-hidden rounded-glam">
                  {/* Anything really uploaded against the service wins; the
                      shipped artwork is the fallback, and a category with
                      neither still falls through to the brand metal. */}
                  {category.imageUrl ? (
                    <GlamImage
                      src={category.imageUrl}
                      alt=""
                      width={420}
                      height={320}
                      sizes="210px"
                      className="aspect-[4/3] w-full object-cover transition duration-[320ms] ease-glam group-hover:scale-[1.03]"
                    />
                  ) : categoryImagePath(category.name) ? (
                    <BrandImage
                      path={categoryImagePath(category.name)!}
                      alt=""
                      width={420}
                      height={320}
                      sizes="210px"
                      className="aspect-[4/3] w-full object-cover transition duration-[320ms] ease-glam group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="block aspect-[4/3] w-full bg-metal"
                    />
                  )}
                  {/* The icon survives the photograph rather than being
                      replaced by it, on a surface chip so it stays legible
                      whatever the image behind it is doing. */}
                  <span
                    aria-hidden
                    className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-brand-700 backdrop-blur"
                  >
                    {CATEGORY_ICONS[category.name] ?? (
                      <SquaresFour size={18} weight="light" />
                    )}
                  </span>
                </span>

                {/* Label beneath the image rather than over it: a category
                    name on a photograph of a face is the one place contrast
                    cannot be guaranteed. */}
                <span className="mt-2.5 block text-sm font-semibold text-ink">
                  {category.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {category.providerCount}{" "}
                  {category.providerCount === 1 ? "provider" : "providers"}
                </span>
              </Link>
            ))}

            {/* The last card is the way out of the rail, in the rose tint. */}
            <Link
              href="/search"
              className="w-[180px] shrink-0 snap-start sm:w-[210px]"
            >
              <span className="flex aspect-[4/3] w-full items-center justify-center rounded-glam border border-brand-200 bg-brand-50 text-brand-700 transition duration-[180ms] ease-glam hover:bg-brand-100">
                <SquaresFour size={28} weight="light" aria-hidden />
              </span>
              <span className="mt-2.5 block text-sm font-semibold text-brand-700">
                All categories
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {stats.serviceCount} services
              </span>
            </Link>
          </Rail>
        </Container>
      ) : null}

      {/* ================= Block 3 — featured vendors ================ */}
      {cards.length > 0 ? (
        <Container className="pt-14 sm:pt-16">
          <BlockHeading
            title="Featured vendors"
            lede="Ranked by rating and completed work, never by what they paid us."
            action={<SeeAll href="/search" />}
          />
          <FeaturedProviders
            providers={cards}
            categories={categories.map((category) => category.name)}
          />
        </Container>
      ) : null}

      {/* ================= Block 4 — cities ============================ */}
      {cities.length > 0 ? (
        <section className="mt-14 bg-sunken py-14 sm:mt-16 sm:py-16">
          <Container>
            <BlockHeading
              title="Browse by city"
              lede="Vendors who already cover your area."
            />
            <Rail label="Cities">
              {cities.map((city) => (
                <Link
                  key={city.city}
                  href={`/search?location=${encodeURIComponent(city.city)}`}
                  className="group relative w-[200px] shrink-0 snap-start overflow-hidden rounded-glam sm:w-[240px]"
                >
                  {/* No city photography exists yet, so this is the brand
                      metal rather than a stock skyline nobody chose. */}
                  <span
                    aria-hidden
                    className="block aspect-[4/3] w-full bg-metal transition duration-[320ms] ease-glam group-hover:scale-[1.03]"
                  />
                  {/* Name over the image, so the scrim is load-bearing and
                      stays fixed in both themes. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                  />
                  <span className="absolute inset-x-0 bottom-0 p-3.5">
                    <span className="block text-sm font-bold text-white">
                      {city.city}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/80">
                      {city.providerCount}{" "}
                      {city.providerCount === 1 ? "provider" : "providers"} ·{" "}
                      {city.sector}
                    </span>
                  </span>
                </Link>
              ))}
            </Rail>
          </Container>
        </section>
      ) : null}

      {/* ================= Block 5 — how it works ====================== */}
      <Container className="pt-14 sm:pt-16">
        <BlockHeading
          title="How it works"
          lede="Three steps to someone at your door."
        />
        <ol className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title}>
              {/* The image slot is the brand metal until photography for these
                  three steps exists. It holds its ratio either way, so the
                  block does not reflow when pictures arrive. */}
              <div className="relative overflow-hidden rounded-glam">
                <span
                  aria-hidden
                  className="block aspect-[16/10] w-full bg-metal"
                />
                <span
                  aria-hidden
                  className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-glam-sm bg-surface/90 text-brand-700 backdrop-blur"
                >
                  {step.icon}
                </span>
              </div>
              <p className="mt-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                Step 0{index + 1}
              </p>
              <h3 className="mt-1.5 font-display text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[15px] text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>

      {/* ================= CTA band ==================================== */}
      <Container className="pt-14 sm:pt-16">
        {/*
          A warm gradient band, in the brand's own champagne and rose rather
          than a borrowed accent. Not the metal gradient: that is reserved for
          the single primary action, which is the button sitting on top of it.
        */}
        <div className="overflow-hidden rounded-glam-lg bg-gradient-to-br from-accent-100 via-accent-100 to-brand-50 p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
                Bring your next occasion to life
              </h2>
              <p className="mt-3 max-w-lg text-[15px] text-ink-muted">
                Whether you need someone this evening or you want to take
                bookings of your own, it starts in the same place.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam active:scale-[0.98]"
                >
                  Find a vendor
                  <ArrowRight size={15} weight="bold" aria-hidden />
                </Link>
                <Link
                  href="/become-a-vendor"
                  className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-sunken active:scale-[0.98]"
                >
                  Become a vendor
                </Link>
              </div>
            </div>

            {/* Overlapping avatar stack. The overflow chip counts the
                vendors the stack could not show — a marketplace that
                inflates its own numbers here is contradicted by the search
                page one click away. */}
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex -space-x-3">
                {cards.slice(0, 4).map((provider) => (
                  <GlamImage
                    key={provider.id}
                    src={provider.imageUrl}
                    alt=""
                    width={80}
                    height={80}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-surface"
                  />
                ))}
                {stats.providerCount > 4 ? (
                  <span className="flex h-10 items-center rounded-full bg-surface px-3 font-mono text-xs font-semibold text-ink ring-2 ring-surface">
                    +{stats.providerCount - 4}
                  </span>
                ) : null}
              </span>
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">
                  {stats.providerCount}
                </span>{" "}
                vetted {stats.providerCount === 1 ? "provider" : "providers"}{" "}
                taking work across {stats.cityCount}{" "}
                {stats.cityCount === 1 ? "city" : "cities"}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="tap-44 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
    >
      See all
      <ArrowRight size={14} weight="light" aria-hidden />
    </Link>
  );
}

/**
 * A hero trust figure.
 *
 * Uses the ordinary ink tokens, which is safe here precisely because the band
 * scopes the light palette — inside it they resolve to their light-mode values
 * in both themes, matching the cream the copy sits on.
 */
function HeroFigure({
  icon,
  value,
  label,
}: {
  icon?: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon ? <span className="text-accent-700">{icon}</span> : null}
      <div>
        <dt className="sr-only">{label}</dt>
        <dd>
          <span data-numeric className="text-sm font-bold text-ink">
            {value}
          </span>{" "}
          <span className="text-sm text-ink-muted">{label}</span>
        </dd>
      </div>
    </div>
  );
}
