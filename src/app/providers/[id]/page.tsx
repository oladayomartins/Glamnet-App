import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Broadcast,
  Lightning,
  MapPin,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { getProviderProfile } from "@/lib/server/provider-profile";
import { GlamImage } from "@/components/glam-image";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDay, formatDuration, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The customer-facing vendor profile (§C-03).
 *
 * One honest thing this page has to say, and says twice: booking from here
 * does not book *this* vendor. GLAMNET broadcasts to every vetted vendor
 * in the sector who is free for the whole appointment, and the first to accept
 * takes the job. A profile that implied otherwise would be selling a promise
 * the matching engine does not make.
 */
export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await getProviderProfile(id);

  // Also 404 for a vendor who is pending, rejected or not taking work: a
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

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      <Link
        href="/search"
        className="tap-44 text-sm text-ink-muted hover:text-brand-700"
      >
        ← All vendors
      </Link>

      {/* --- Gallery + identity ------------------------------------------ */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          {/* 4:3 lead image with a thumbnail strip beneath. Real portfolio
              photography drops into these slots; the ratios are fixed now so
              nothing reflows when it arrives. */}
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
            <span className="absolute left-4 top-4">
              {provider.freeTonight ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emergency px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-on-emergency">
                  <Lightning size={11} weight="fill" />
                  Free tonight
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-normal-ink">
                  <ShieldCheck size={11} weight="fill" className="text-normal" />
                  Vetted
                </span>
              )}
            </span>
          </div>
          <div aria-hidden className="mt-2 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="aspect-[4/3] rounded-glam-sm bg-sunken"
              />
            ))}
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            {provider.name}
          </h1>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-1" data-numeric>
              <Star size={14} weight="fill" className="text-accent-500" aria-hidden />
              <span className="font-semibold text-ink">
                {provider.rating.toFixed(1)}
              </span>
              <span className="text-ink-muted">
                ({provider.reviewCount}{" "}
                {provider.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </span>
            <span className="flex items-center gap-1 text-ink-muted">
              <MapPin size={14} weight="light" aria-hidden />
              {provider.city} · {provider.sector}
            </span>
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Fact label="Completed jobs" value={String(provider.completedBookings)} />
            <Fact label="Travel fee" value={formatMoney(provider.travelFeeMinor)} />
            <Fact
              label="Works"
              value={
                provider.workingDays.length === 0
                  ? "No hours set"
                  : provider.workingDays
                      .map((day) => day.slice(0, 3))
                      .join(" · ")
              }
            />
            <Fact
              label="From"
              value={fromMinor === null ? "—" : formatMoney(fromMinor)}
            />
          </dl>

          {provider.bio ? (
            <p className="mt-5 text-[15px] text-ink-muted">{provider.bio}</p>
          ) : null}

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

      {/* --- Services ----------------------------------------------------- */}
      <section>
        <SectionTitle hint={`${baseServices.length} services`}>
          What {provider.name} offers
        </SectionTitle>

        {baseServices.length === 0 ? (
          <EmptyState
            icon={<Broadcast size={24} weight="light" />}
            title="No services listed"
            action={
              <Link
                href="/search"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                See other vendors
              </Link>
            }
          >
            This vendor has not listed anything bookable yet.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {baseServices.map((service) => (
              <li key={service.id}>
                <ServiceRow hubId={provider.hubId} service={service} />
              </li>
            ))}
          </ul>
        )}

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

      {/* --- Reviews ------------------------------------------------------ */}
      <section>
        <SectionTitle hint="Most recent first">Reviews</SectionTitle>

        {provider.reviews.length === 0 ? (
          <EmptyState icon={<Star size={24} weight="light" />}>
            No reviews yet. Ratings appear here once a customer has had the
            appointment and rated the work.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {provider.reviews.map((review) => (
              <li key={review.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={13}
                          weight={star <= review.rating ? "fill" : "light"}
                          className={
                            star <= review.rating
                              ? "text-accent-500"
                              : "text-ink-muted/50"
                          }
                          aria-hidden
                        />
                      ))}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {review.services.join(" + ")} · {formatDay(review.at)}
                    </span>
                  </div>
                  {review.note ? (
                    <p className="mt-2 text-[15px] text-ink">{review.note}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
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
        <span className="mt-0.5 block text-xs font-semibold text-brand-700">
          Add
        </span>
      </span>
    </Link>
  );
}
