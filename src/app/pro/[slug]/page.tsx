import type { Metadata } from "next";
import Link from "next/link";
import { citySlug } from "@/lib/domain/postcode";
import { notFound } from "next/navigation";
import {
  Clock,
  InstagramLogo,
  MapPin,
  SealCheck,
  ShieldCheck,
  Star,
  TiktokLogo,
} from "@phosphor-icons/react/dist/ssr";
import { getStorefront, storefrontDays, workspaceLabel } from "@/lib/server/storefront";
import { getSessionUser } from "@/lib/auth/session";
import { GlamImage } from "@/components/glam-image";
import { LookbookCarousel } from "./lookbook-carousel";
import { AreaMap } from "./area-map";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { SectionNav, type SectionLink } from "@/components/section-nav";
import { describeDayHours } from "@/lib/domain/opening-hours";
import { vendorTags } from "@/lib/domain/vendor-tags";
import { aboutSections } from "@/lib/domain/about-sections";
import { SaveVendor } from "@/components/save-vendor";
import { prisma } from "@/lib/server/prisma";
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
  //
  // Averaged over the loaded page of reviews; the count beside it is the true
  // total, which is the figure a customer is actually judging the score by.
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

  // What this vendor is, at a glance: where they work and whether they come
  // to you, then whatever they have told us about the space.
  // Whether this customer has already saved the vendor. Only asked for a
  // signed-in customer — nobody else can save, so nobody else needs the query.
  const saved =
    viewer?.role === "CUSTOMER" && viewer.customerId
      ? (await prisma.savedVendor.count({
          where: { customerId: viewer.customerId, providerId: store.id },
        })) > 0
      : false;

  // The guided About, skipping whatever the vendor left blank.
  const about = aboutSections(store);

  const tags = vendorTags({
    workspaceType: store.workspaceType,
    travelsToClients: store.travelsToClients,
    amenities: store.amenities,
  });

  // A long storefront is a lot of thumb on a phone. Only list a section the
  // page actually has: a Reviews link that jumps to an empty box is worse
  // than no link at all.
  const sections: SectionLink[] = [
    ...(store.lookbook.length > 0 ? [{ id: "photos", label: "Photos" }] : []),
    { id: "services", label: "Services" },
    ...(area ? [{ id: "where", label: "Where" }] : []),
    ...(store.reviews.length > 0 ? [{ id: "reviews", label: "Reviews" }] : []),
    { id: "about", label: "About" },
  ];

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      {/* --- Lookbook carousel: the three best transformations ------------
          Only rendered once the vendor has uploaded looks: three empty
          frames would be the loudest thing on the page and say nothing. */}
      {store.lookbook.length > 0 ? (
        <div id="photos" data-section-target>
        <LookbookCarousel
          looks={store.lookbook.map((image) => ({ id: image.id, url: image.url, caption: image.caption }))}
          providerName={store.name}
          backHref={backHref}
        />
        </div>
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
              {store.reviewCount} {store.reviewCount === 1 ? "review" : "reviews"})
            </span>
          )}
          <SaveVendor
            providerId={store.id}
            initialSaved={saved}
            canSave={viewer?.role === "CUSTOMER" && Boolean(viewer.customerId)}
            signInHref={`/sign-in?next=${encodeURIComponent(`/pro/${slug}`)}`}
          />

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
        {tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li
                key={tag.label}
                className="inline-flex min-h-8 items-center rounded-full bg-sunken px-3 text-xs font-semibold text-ink-muted"
              >
                {tag.label}
              </li>
            ))}
          </ul>
        ) : null}

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

      <SectionNav sections={sections} />

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

      <div id="services" data-section-target>
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
      </div>

      {/* --- Where: the area only, never the address ---------------------- */}
      {area ? (
        <section id="where" data-section-target>
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
      <section id="reviews" data-section-target>
        <SectionTitle
          hint={
            store.reviewCount > store.reviews.length
              ? `${store.reviewCount} in total · most recent first`
              : "Left by clients after their appointment"
          }
        >
          Reviews
        </SectionTitle>
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

      {/* --- About: hours and the practical questions -------------------- */}
      <section id="about" data-section-target>
        <SectionTitle
          hint={store.openUntilLabel ?? undefined}
        >
          About {store.name}
        </SectionTitle>

        {about.length > 0 ? (
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            {about.map((section) => (
              <div key={section.key}>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  {section.heading}
                </h3>
                {/* whitespace-pre-line so a vendor's own line breaks survive;
                    the field is a textarea, and they use them. */}
                <p className="mt-1.5 whitespace-pre-line text-[15px] text-ink-muted">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Opening hours
            </h3>
            {/* Straight from the ProviderAvailability rows the vendor edits in
                their dashboard, so a storefront cannot say "closed today"
                while the dashboard says "working". */}
            <dl className="mt-2 space-y-1">
              {store.weekHours.map((day) => (
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
            {/* Being at work is not the same as being free, so the hours never
                speak to bookability — "Next available" above does. */}
            <p className="mt-3 text-xs text-ink-muted">
              Working hours, not free slots. Check availability when you book.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Good to know
            </h3>
            <ul className="mt-2 space-y-2">
              {/* Facts about how Glamnet works, plus the two that come from
                  this vendor's own record. Nothing that needs a field they
                  have not filled in. */}
              <TrustPoint>Identity and insurance checked before approval</TrustPoint>
              <TrustPoint>
                {store.workspaceType === "MOBILE"
                  ? `Travels to clients across ${store.sector}`
                  : `${workspaceLabel(store.workspaceType)} in ${store.sector}${
                      store.travelsToClients ? ", and travels to you" : ""
                    }`}
              </TrustPoint>
              <TrustPoint>
                Price confirmed before you pay — no surprises on the day
              </TrustPoint>
              <TrustPoint>
                Card held at booking, taken with your PIN at the end
              </TrustPoint>
            </ul>
          </Card>
        </div>
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
