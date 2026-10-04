import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { listVendorReviews } from "@/lib/server/reviews";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { ReviewReplyForm } from "@/components/review-reply-form";
import { formatDay } from "@/lib/format";
import { requireVendorPage } from "../access";

export const dynamic = "force-dynamic";

/**
 * The vendor's reviews: every rating and comment clients have left, with a
 * public reply under each. Replies show on the storefront beneath the review.
 */
export default async function VendorReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireVendorPage(id, `/provider/${id}/reviews`);
  const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  if (!provider) notFound();

  const reviews = await listVendorReviews(id);
  const isOwner = viewer.providerId === id;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => review.rating === stars).length,
  }));
  const unanswered = reviews.filter((review) => review.note && !review.reply).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provider/${id}/settings`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700">
          ← Profile &amp; settings
        </Link>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">Reviews</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What clients said after their appointments.{" "}
          {provider.slug ? (
            <Link href={`/pro/${provider.slug}#reviews`} className="font-semibold text-ink hover:text-brand-700">
              See them on your storefront →
            </Link>
          ) : null}
        </p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState icon={<Star size={24} weight="light" />}>
          No reviews yet. Clients are asked to rate you after each appointment, and their reviews appear here.
        </EmptyState>
      ) : (
        <>
          <Card className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
              <p className="font-display text-4xl font-bold text-ink" data-numeric>
                {average.toFixed(1)}
              </p>
              <p className="text-sm text-ink-muted">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </p>
            </div>
            <ul className="space-y-1">
              {counts.map(({ stars, count }) => (
                <li key={stars} className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="w-6 text-right" data-numeric>{stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span
                      className="block h-full rounded-full bg-accent-500"
                      style={{ width: `${(count / reviews.length) * 100}%` }}
                    />
                  </span>
                  <span className="w-6" data-numeric>{count}</span>
                </li>
              ))}
            </ul>
          </Card>

          <section>
            <SectionTitle hint={isOwner && unanswered > 0 ? `${unanswered} waiting for a reply` : undefined}>
              All reviews
            </SectionTitle>
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li key={review.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              weight={star <= review.rating ? "fill" : "light"}
                              className={star <= review.rating ? "text-accent-500" : "text-ink-muted/50"}
                              aria-hidden
                            />
                          ))}
                        </span>
                        <span className="text-sm font-semibold text-ink">{review.client}</span>
                      </span>
                      <Link href={`/bookings/${review.id}`} className="text-xs text-ink-muted hover:text-brand-700">
                        {review.services.join(" + ")} · {formatDay(review.at)}
                      </Link>
                    </div>
                    {review.note ? (
                      <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{review.note}</p>
                    ) : (
                      <p className="mt-2 text-sm text-ink-muted">A rating without a comment.</p>
                    )}
                    {isOwner ? (
                      <ReviewReplyForm bookingId={review.id} initialReply={review.reply} />
                    ) : review.reply ? (
                      <p className="mt-3 rounded-glam-sm bg-sunken p-3 text-sm text-ink">{review.reply}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
