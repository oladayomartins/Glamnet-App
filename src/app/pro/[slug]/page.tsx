import type { Metadata } from "next";
import Link from "next/link";
import { citySlug } from "@/lib/domain/postcode";
import { notFound } from "next/navigation";
import { Clock, InstagramLogo, MapPin, SealCheck, Star, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { getStorefront, storefrontDays, workspaceLabel } from "@/lib/server/storefront";
import { getSessionUser } from "@/lib/auth/session";
import { GlamImage } from "@/components/glam-image";
import { LookbookCarousel } from "./lookbook-carousel";
import { AreaMap } from "./area-map";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { StorefrontBooking } from "./storefront-booking";
import { AdSlot } from "@/components/ad-slot";
import { lookupOutcode } from "@/lib/server/geo";
import { TrackEvent } from "@/components/analytics";
import { CURRENCY, serviceItem } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/** "Mon 28 Sep, 09:00", in UK time whatever the server's clock. */
const nextAvailableFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
});

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStorefront(slug);
  if (!store) return { title: "Storefront not found" };
  return {
    title: `${store.name} · ${store.hub.city}`,
    description: store.bio || `Book ${store.name} on GLAMNET.`,
    alternates: { canonical: `${siteUrl()}/pro/${slug}` },
  };
}

/**
 * A vendor's storefront blade (Open Marketplace Directory §B):
 * glamnet.co/pro/:username.
 *
 * Lookbook, menu, calendar and reviews for one named vendor, and a booking
 * that goes to that vendor alone. The same page serves the vendor's own bio
 * link and a click-through from the directory; the `via=directory` marker the
 * directory adds is what tells the commission engine the two apart.
 */
export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ via?: string }>;
}) {
  const [{ slug }, { via }] = await Promise.all([params, searchParams]);
  const store = await getStorefront(slug);
  if (!store) notFound();

  const viewer = await getSessionUser();
  // The public pin: the centre of the vendor's own outward code.
  const ownArea = store.sector !== store.hub.sector ? await lookupOutcode(store.sector) : null;
  const area = ownArea
    ? { lat: ownArea.lat, lng: ownArea.lng }
    : store.hub.latitude !== null && store.hub.longitude !== null
      ? { lat: store.hub.latitude, lng: store.hub.longitude }
      : null;
  // Before the first review there is no score to show: the stored rating is
  // only the default, and "5.0 · no reviews yet" reads as a mistake.
  const reviewAverage =
    store.reviews.length > 0
      ? store.reviews.reduce((sum, review) => sum + review.rating, 0) / store.reviews.length
      : null;

  // "Next available", for the shortest service on the menu: whether this pro
  // can fit the customer in at all, before they choose anything.
  const shortest = Math.min(
    ...store.menu.filter((item) => item.kind === "SERVICE").map((item) => item.durationMinutes),
  );
  const nextFree = Number.isFinite(shortest)
    ? (await storefrontDays(store.id, shortest, new Date())).find((day) => day.firstStartAt)?.firstStartAt ?? null
    : null;
  const backHref = `/${citySlug(store.hub.city)}/salons`;

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      {/* --- Lookbook carousel: the three best transformations ------------
          Only rendered once the vendor has uploaded looks: three empty
          frames would be the loudest thing on the page and say nothing. */}
      {store.lookbook.length > 0 ? (
        <LookbookCarousel
          looks={store.lookbook.map((image) => ({ id: image.id, url: image.url, caption: image.caption }))}
          providerName={store.name}
          backHref={backHref}
        />
      ) : null}

      {/* --- Identity ------------------------------------------------------ */}
      <section>
        <div className="flex items-center gap-4">
          {store.avatarUrl ? (
            <GlamImage
              src={store.avatarUrl}
              alt={store.name}
              width={160}
              height={160}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-accent-500 sm:h-20 sm:w-20"
            />
          ) : null}
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            {store.name}
            <SealCheck size={24} weight="fill" className="text-accent-500" aria-label="Verified" />
          </h1>
        </div>
        <p className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
          <MapPin size={14} weight="light" aria-hidden />
          {workspaceLabel(store.workspaceType)} · {store.sector}, {store.hub.city}
          {store.workspaceType !== "MOBILE" && store.travelsToClients ? " · Also travels to you" : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {reviewAverage === null ? (
            <span className="rounded-full bg-sunken px-3 py-1 text-xs font-bold text-accent-700 ring-1 ring-accent-500/40">
              New on Glamnet
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-ink-muted" data-numeric>
              <Star size={14} weight="fill" className="text-accent-500" aria-hidden />
              <span className="font-semibold text-ink">{reviewAverage.toFixed(1)}</span>(
              {store.reviews.length} {store.reviews.length === 1 ? "review" : "reviews"})
            </span>
          )}
          {store.instagramHandle ? (
            <a
              href={`https://instagram.com/${store.instagramHandle}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Instagram, @${store.instagramHandle}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-accent-500"
            >
              <InstagramLogo size={16} aria-hidden />
              Instagram
            </a>
          ) : null}
          {store.tiktokHandle ? (
            <a
              href={`https://tiktok.com/@${store.tiktokHandle}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`TikTok, @${store.tiktokHandle}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-accent-500"
            >
              <TiktokLogo size={16} aria-hidden />
              TikTok
            </a>
          ) : null}
        </div>
        {store.bio ? <p className="mt-4 max-w-2xl text-[15px] text-ink-muted">{store.bio}</p> : null}
        <p className="mt-4 flex items-center gap-2.5 rounded-glam-sm border border-normal/30 bg-normal-soft p-3 text-sm text-ink">
          <Clock size={20} className="shrink-0 text-normal-ink" aria-hidden />
          {nextFree ? (
            <span>
              <span className="font-bold">Next available:</span> {nextAvailableFormat.format(new Date(nextFree))}
            </span>
          ) : (
            <span>No free times in the next two weeks.</span>
          )}
        </p>
      </section>

      {/* --- Menu, calendar and checkout ---------------------------------- */}
      <TrackEvent
        name="view_item"
        dedupeKey={store.id}
        params={{
          currency: CURRENCY,
          vendor_id: store.id,
          booking_source: via === "directory" ? "marketplace" : "direct_link",
          items: store.menu
            .filter((item) => item.kind === "SERVICE")
            .slice(0, 25)
            .map((item, index) => ({
              ...serviceItem({ ...item, vendor: store.name, city: store.hub.city }),
              index,
            })),
        }}
      />

      <StorefrontBooking
        slug={slug}
        providerName={store.name}
        menu={store.menu}
        source={via === "directory" ? "MARKETPLACE" : "DIRECT_LINK"}
        hasWorkspace={store.workspaceType !== "MOBILE"}
        workspaceLabel={`${workspaceLabel(store.workspaceType)} in ${store.sector}`}
        travelsToClients={store.travelsToClients}
        travelFeeMinor={store.hub.travelFeeMinor}
        nearbyNails={store.nearbyNails}
        signedInAsCustomer={viewer?.role === "CUSTOMER"}
        vendorArea={area}
      />

      {/* --- Where: the area only, never the address ---------------------- */}
      {area ? (
        <section>
          <SectionTitle hint="Area shown, not the address">Where</SectionTitle>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
            <AreaMap center={area} label={`${store.name}'s area`} />
            <p className="text-sm text-ink-muted">
              {store.workspaceType === "MOBILE"
                ? `${store.name} travels to clients from ${store.sector}, ${store.hub.city}.`
                : `${workspaceLabel(store.workspaceType)} in ${store.sector}, ${store.hub.city}${store.travelsToClients ? ", and travels to clients too" : ""}.`}{" "}
              The exact address is shared once your booking is confirmed.
            </p>
          </div>
        </section>
      ) : null}

      {/* --- Client review matrix: read-only ------------------------------ */}
      <section>
        <SectionTitle hint="Left by clients after their appointment">Reviews</SectionTitle>
        {store.reviews.length === 0 ? (
          <EmptyState icon={<Star size={24} weight="light" />}>
            No reviews yet. Reviews appear once a client has finished an appointment.
          </EmptyState>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {store.reviews.map((review) => (
              <li key={review.id}>
                <Card className="h-full p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={13}
                          weight={star <= review.rating ? "fill" : "light"}
                          className={star <= review.rating ? "text-accent-500" : "text-ink-muted/50"}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {review.services.join(" + ")} · {formatDay(review.at)}
                    </span>
                  </div>
                  {review.note ? <p className="mt-2 text-[15px] text-ink">{review.note}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdSlot slot="STOREFRONT_FOOTER" />

      <p className="text-center text-xs text-ink-muted">
        <Link href={backHref} className="inline-flex min-h-11 items-center hover:text-accent-700">
          ← More vendors in {store.hub.city}
        </Link>
      </p>
    </div>
  );
}
