import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Broadcast,
  CalendarCheck,
  Lightning,
  MapPin,
  Sparkle,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { getProviderProfile } from "@/lib/server/provider-profile";
import { GlamImage } from "@/components/glam-image";
import { SectionNav, type SectionLink } from "@/components/section-nav";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { describeDayHours } from "@/lib/domain/opening-hours";
import { formatDay, formatDuration, formatMoney, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The customer-facing provider profile (§C-03).
 *
 * One honest thing this page has to say, and says twice: booking from here
 * does not book *this* provider. GLAMNET broadcasts to every vetted provider
 * in the sector who is free for the whole appointment, and the first to accept
 * takes the job. A profile that implied otherwise would be selling a promise
 * the matching engine does not make.
 *
 * The page is long, so it is navigable: a sticky Services · Reviews · About
 * bar sits under the hero and jumps between sections, which is the difference
 * between a usable and an unusable page on a phone.
 */
export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await getProviderProfile(id);

  // Also 404 for a provider who is pending, rejected or not taking work: a
  // page whose only possible outcome is a dead end is not worth serving.
  if (!provider) notFound();

  const baseServices = provider.services.filter(
    (service) => service.kind !== "ADDON",
  );
  const addons = provider.services.filter((service) => service.kind === "ADDON");
  const fromMinor =
    baseServices.length > 0
      ? Math.min(...baseServices.map((service) => service.priceMinor))
      : null;

  // Only advertise a section the page actually has. A "Reviews" link that
  // jumps to an empty box is worse than no link.
  const sections: SectionLink[] = [
    ...(baseServices.length > 0
      ? [{ id: "services", label: "Services" }]
      : []),
    ...(provider.reviews.length > 0
      ? [{ id: "reviews", label: "Reviews" }]
      : []),
    { id: "about", label: "About" },
  ];

  return (
    <div className="space-y-8 pb-6">
      <Link
        href="/search"
        className="tap-44 text-sm text-ink-muted hover:text-brand-700"
      >
        ← All providers
      </Link>

      {/* --- Hero: photo + identity --------------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-glam-lg shadow-card">
          <GlamImage
            src={provider.avatarUrl}
            alt={`Work by ${provider.name}`}
            width={880}
            height={660}
            sizes="(max-width: 1024px) 100vw, 560px"
            priority
            className="h-full w-full object-cover"
          />
          <span className="absolute left-4 top-4 flex flex-wrap gap-1.5">
            {provider.reputation.badge === "NEW" ? (
              <Badge icon={<Sparkle size={11} weight="fill" />} tone="accent">
                New on GLAMNET
              </Badge>
            ) : null}
            {provider.reputation.badge === "TOP_RATED" ? (
              <Badge icon={<Star size={11} weight="fill" />} tone="accent">
                Top rated
              </Badge>
            ) : null}
            {provider.freeTonight ? (
              <Badge icon={<Lightning size={11} weight="fill" />} tone="emergency">
                Free tonight
              </Badge>
            ) : (
              <Badge icon={<ShieldCheck size={11} weight="fill" />} tone="vetted">
                Vetted
              </Badge>
            )}
          </span>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            {provider.name}
          </h1>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {/* A rating is shown only once it is based on something. A brand
                new provider gets an honest "New on GLAMNET" instead of a 5.0
                nobody gave them — see lib/domain/reputation.ts. */}
            {provider.reputation.rating === null ? (
              <span className="flex items-center gap-1 font-semibold text-accent-700">
                <Sparkle size={14} weight="fill" aria-hidden />
                {provider.reputation.label}
              </span>
            ) : (
              <span className="flex items-center gap-1" data-numeric>
                <Star
                  size={14}
                  weight="fill"
                  className="text-accent-500"
                  aria-hidden
                />
                <span className="font-semibold text-ink">
                  {provider.reputation.rating.toFixed(1)}
                </span>
                <span className="text-ink-muted">
                  ({provider.reputation.reviewCount}{" "}
                  {provider.reputation.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </span>
            )}
            <span className="flex items-center gap-1 text-ink-muted">
              <MapPin size={14} weight="light" aria-hidden />
              {provider.city} · {provider.sector}
            </span>
          </p>

          <AvailabilityLine
            nextOpeningAt={provider.nextOpeningAt}
            nextOpeningIsToday={provider.nextOpeningIsToday}
            openUntilLabel={provider.openUntilLabel}
          />

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Fact
              label="Completed jobs"
              value={String(provider.completedBookings)}
            />
            <Fact label="Travel fee" value={formatMoney(provider.travelFeeMinor)} />
            <Fact
              label="From"
              value={fromMinor === null ? "—" : formatMoney(fromMinor)}
            />
            <Fact
              label="Services"
              value={String(baseServices.length + addons.length)}
            />
          </dl>

          <div className="mt-6 flex items-start gap-3 rounded-glam border border-line bg-sunken p-4">
            <Broadcast
              size={20}
              weight="light"
              aria-hidden
              className="mt-0.5 shrink-0 text-brand-700"
            />
            <p className="text-[15px] text-ink-muted">
              Booking here broadcasts your request to every vetted provider in{" "}
              {provider.sector} who is free for your whole appointment,{" "}
              {provider.name} included. The first to accept takes the job.
            </p>
          </div>
        </div>
      </section>

      <SectionNav sections={sections} />

      {/* --- Services ----------------------------------------------------- */}
      {baseServices.length > 0 ? (
        <section id="services" data-section-target>
          <SectionTitle hint={`${baseServices.length} services`}>
            What {provider.name} offers
          </SectionTitle>

          <ul className="space-y-2">
            {baseServices.map((service) => (
              <li key={service.id}>
                <ServiceRow hubId={provider.hubId} service={service} />
              </li>
            ))}
          </ul>

          {addons.length > 0 ? (
            <>
              <p className="mb-2 mt-6 text-sm font-medium text-ink">
                Premium add-ons
              </p>
              <ul className="space-y-2">
                {addons.map((service) => (
                  <li key={service.id}>
                    <ServiceRow hubId={provider.hubId} service={service} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : (
        <section>
          <SectionTitle>What {provider.name} offers</SectionTitle>
          <EmptyState
            icon={<Broadcast size={24} weight="light" />}
            title="No services listed"
            action={
              <Link
                href="/search"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                See other providers
              </Link>
            }
          >
            This provider has not listed anything bookable yet.
          </EmptyState>
        </section>
      )}

      {/* --- Reviews ------------------------------------------------------ */}
      {provider.reviews.length > 0 ? (
        <section id="reviews" data-section-target>
          <SectionTitle
            hint={`${provider.reputation.reviewCount} in total · most recent first`}
          >
            Reviews
          </SectionTitle>

          <ul className="space-y-2">
            {provider.reviews.map((review) => (
              <li key={review.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Stars rating={review.rating} />
                    <span className="text-xs text-ink-muted">
                      {formatDay(review.at)}
                    </span>
                  </div>
                  {/* Naming the service is what makes a review believable:
                      "5 stars" says nothing, "5 stars for a silk press" says
                      what was actually delivered. */}
                  {review.services.length > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-brand-700">
                      {review.services.join(" + ")}
                    </p>
                  ) : null}
                  {review.note ? (
                    <p className="mt-2 text-[15px] text-ink">{review.note}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>

          {provider.reputation.reviewCount > provider.reviews.length ? (
            <p className="mt-3 text-sm text-ink-muted">
              Showing the {provider.reviews.length} most recent of{" "}
              {provider.reputation.reviewCount}.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* --- About: bio, hours, trust points ------------------------------ */}
      <section id="about" data-section-target>
        <SectionTitle>About {provider.name}</SectionTitle>

        {provider.bio ? (
          <p className="text-[15px] text-ink-muted">{provider.bio}</p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Opening hours
            </h3>
            {/* Straight from the same ProviderAvailability rows the provider
                edits in their dashboard, so the two can never disagree. */}
            <dl className="mt-2 space-y-1">
              {provider.weekHours.map((day) => (
                <div key={day.dayOfWeek} className="flex justify-between gap-3">
                  <dt className="text-sm text-ink-muted">{day.name}</dt>
                  <dd
                    data-numeric
                    className={`text-sm ${
                      day.windows.length === 0
                        ? "text-ink-muted/70"
                        : "font-medium text-ink"
                    }`}
                  >
                    {describeDayHours(day)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Good to know
            </h3>
            <ul className="mt-2 space-y-2">
              {/* Every line here is a fact about how GLAMNET works, not a
                  claim about this provider — nothing that would need a field
                  they have not filled in. */}
              <TrustPoint>Identity and work checked before approval</TrustPoint>
              <TrustPoint>
                Price confirmed before you pay — no surprises on the day
              </TrustPoint>
              <TrustPoint>
                Travels to you in {provider.city} · {provider.sector}
              </TrustPoint>
              <TrustPoint>
                {formatMoney(provider.travelFeeMinor)} travel fee, included in
                the quote
              </TrustPoint>
            </ul>
          </Card>
        </div>
      </section>

      {/* --- Sticky bottom bar: the one metal element on the screen ------- */}
      {baseServices.length > 0 ? (
        <div className="safe-bottom sticky bottom-0 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">
              From{" "}
              <span data-numeric className="font-bold text-accent-700">
                {fromMinor === null ? "—" : formatMoney(fromMinor)}
              </span>
              <span className="hidden sm:inline">
                {" "}
                · plus {formatMoney(provider.travelFeeMinor)} travel
              </span>
            </p>
            <Link
              href={`/book/${provider.hubId}`}
              className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam active:scale-[0.98]"
            >
              Continue
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Available today from 14:00" — the line that answers "can I book this soon?"
 * without the customer having to open the calendar.
 *
 * Green because it is good news and the brand guide keeps red for EMERGENCY;
 * absent entirely when there is no opening inside the horizon, because a
 * vague reassurance here would be worse than silence.
 */
function AvailabilityLine({
  nextOpeningAt,
  nextOpeningIsToday,
  openUntilLabel,
}: {
  nextOpeningAt: Date | null;
  nextOpeningIsToday: boolean;
  openUntilLabel: string | null;
}) {
  if (!nextOpeningAt) {
    return openUntilLabel ? (
      <p className="mt-3 text-sm font-semibold text-normal-ink">
        {openUntilLabel} · fully booked
      </p>
    ) : null;
  }

  return (
    <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-normal-ink">
      <CalendarCheck size={15} weight="fill" className="text-normal" aria-hidden />
      {nextOpeningIsToday
        ? `Available today from ${formatTime(nextOpeningAt)}`
        : `Next available ${formatDay(nextOpeningAt)}, ${formatTime(nextOpeningAt)}`}
      {openUntilLabel ? (
        <span className="font-normal text-ink-muted">· {openUntilLabel}</span>
      ) : null}
    </p>
  );
}

function Badge({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "emergency" | "accent" | "vetted";
}) {
  const tones = {
    // Red is EMERGENCY's alone — "Free tonight" is the urgency signal.
    emergency: "bg-emergency text-on-emergency",
    accent: "bg-surface/95 text-accent-700",
    vetted: "bg-surface/95 text-normal-ink",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={13}
          weight={star <= rating ? "fill" : "light"}
          className={star <= rating ? "text-accent-500" : "text-ink-muted/50"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function TrustPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-muted">
      <ShieldCheck
        size={15}
        weight="light"
        aria-hidden
        className="mt-0.5 shrink-0 text-normal"
      />
      <span>{children}</span>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </dt>
      <dd data-numeric className="mt-0.5 text-[15px] font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}

/** One bookable line. Tapping it opens the builder with that service in. */
function ServiceRow({
  hubId,
  service,
}: {
  hubId: string;
  service: {
    id: string;
    name: string;
    description: string;
    priceMinor: number;
    durationMinutes: number;
  };
}) {
  return (
    <Link
      href={`/book/${hubId}?service=${service.id}`}
      className="flex items-start justify-between gap-4 rounded-glam border border-line bg-surface p-4 shadow-card transition duration-[180ms] ease-glam hover:border-brand-400"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">
          {service.name}
        </span>
        {service.description ? (
          <span className="mt-0.5 block text-sm text-ink-muted">
            {service.description}
          </span>
        ) : null}
        <span data-numeric className="mt-1 block text-xs text-ink-muted">
          {formatDuration(service.durationMinutes)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span data-numeric className="block text-[15px] font-bold text-ink">
          {formatMoney(service.priceMinor)}
        </span>
        <span className="mt-0.5 inline-flex min-h-8 items-center rounded-full bg-brand-50 px-3 text-xs font-bold text-brand-700">
          Book
        </span>
      </span>
    </Link>
  );
}
