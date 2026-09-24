import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InstagramLogo, MapPin, SealCheck, Star, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { getStorefront, workspaceLabel } from "@/lib/server/storefront";
import { getSessionUser } from "@/lib/auth/session";
import { GlamImage } from "@/components/glam-image";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { StorefrontBooking } from "./storefront-booking";

export const dynamic = "force-dynamic";

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
  const reviewAverage =
    store.reviews.length > 0
      ? store.reviews.reduce((sum, review) => sum + review.rating, 0) / store.reviews.length
      : store.rating;

  return (
    <div data-page-width="wide" className="space-y-8 pb-6">
      {/* --- Lookbook carousel: the three best transformations ------------
          Only rendered once the vendor has uploaded looks: three empty
          frames would be the loudest thing on the page and say nothing. */}
      {store.lookbook.length > 0 ? (
        <section aria-label="Lookbook">
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {store.lookbook.map((image, index) => (
              <figure
                key={image.id}
                className="relative aspect-[4/5] w-[78%] shrink-0 snap-center overflow-hidden rounded-glam-lg shadow-card sm:w-auto"
              >
                <GlamImage
                  src={image.url}
                  alt={image.caption || `Look ${index + 1} by ${store.name}`}
                  width={640}
                  height={800}
                  sizes="(max-width: 640px) 78vw, 33vw"
                  priority={index === 0}
                  className="h-full w-full object-cover"
                />
                {image.caption ? (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/80 to-transparent p-3 text-sm text-on-obsidian">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Identity ------------------------------------------------------ */}
      <section>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          {store.name}
          <SealCheck size={24} weight="fill" className="text-accent-500" aria-label="Verified" />
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="flex items-center gap-1" data-numeric>
            <Star size={14} weight="fill" className="text-accent-500" aria-hidden />
            <span className="font-semibold text-ink">{reviewAverage.toFixed(1)}</span>
            {store.reviews.length === 0
              ? "· no reviews yet"
              : `(${store.reviews.length} ${store.reviews.length === 1 ? "review" : "reviews"})`}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={14} weight="light" aria-hidden />
            {workspaceLabel(store.workspaceType)} · {store.sector}, {store.hub.city}
          </span>
          {store.instagramHandle ? (
            <a
              href={`https://instagram.com/${store.instagramHandle}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-accent-700"
            >
              <InstagramLogo size={14} aria-hidden />@{store.instagramHandle}
            </a>
          ) : null}
          {store.tiktokHandle ? (
            <a
              href={`https://tiktok.com/@${store.tiktokHandle}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-accent-700"
            >
              <TiktokLogo size={14} aria-hidden />@{store.tiktokHandle}
            </a>
          ) : null}
        </p>
        {store.bio ? <p className="mt-4 max-w-2xl text-[15px] text-ink-muted">{store.bio}</p> : null}
      </section>

      {/* --- Menu, calendar and checkout ---------------------------------- */}
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
      />

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

      <p className="text-center text-xs text-ink-muted">
        <Link href={`/${store.hub.city.toLowerCase()}/salons`} className="hover:text-accent-700">
          ← More vendors in {store.hub.city}
        </Link>
      </p>
    </div>
  );
}
