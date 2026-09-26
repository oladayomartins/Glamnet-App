/**
 * What a storefront is allowed to claim about a provider's reputation.
 *
 * The rule this encodes: **a rating is only shown once it is based on
 * something.** A brand-new provider currently renders as "5.0 ★ · no reviews
 * yet", which reads worse than saying nothing — it looks like a default
 * dressed up as an achievement, and a customer who spots that stops trusting
 * the 4.8s as well. So a provider with no reviews gets an honest "New on
 * GLAMNET" badge instead, and every rating that *is* shown carries the number
 * of reviews behind it, so an early 5.0 from three customers is legible as
 * exactly that.
 *
 * Pure: no database, no formatting of dates, nothing framework-specific.
 */

export type ReputationBadge =
  | "NEW"
  | "UNREVIEWED"
  | "TOP_RATED"
  | "ESTABLISHED";

export interface Reputation {
  badge: ReputationBadge;
  /** Null when there is nothing honest to show. */
  rating: number | null;
  reviewCount: number;
  /** "5.0 (3 reviews)" / "New on GLAMNET". Ready to render. */
  label: string;
}

/**
 * Reviews needed before a high rating counts as "Top rated".
 *
 * Five is the point at which one glowing friend cannot carry the badge on
 * their own — below it, the sample is too small for the label to mean more
 * than the number already does.
 */
export const TOP_RATED_MIN_REVIEWS = 5;
export const TOP_RATED_MIN_RATING = 4.8;

export function summariseReputation(
  rating: number,
  reviewCount: number,
  completedBookings = 0,
): Reputation {
  if (reviewCount <= 0) {
    // "New" is a claim about experience, not just about the review column.
    // Someone who has finished three hundred jobs without anyone writing one
    // is not new, and labelling them so would be its own small lie — so they
    // get the plainer "No reviews yet". Neither case shows a rating.
    const isActuallyNew = completedBookings <= 0;
    return {
      badge: isActuallyNew ? "NEW" : "UNREVIEWED",
      rating: null,
      reviewCount: 0,
      label: isActuallyNew ? "New on GLAMNET" : "No reviews yet",
    };
  }

  const rounded = Math.round(rating * 10) / 10;
  const noun = reviewCount === 1 ? "review" : "reviews";

  return {
    badge:
      reviewCount >= TOP_RATED_MIN_REVIEWS && rounded >= TOP_RATED_MIN_RATING
        ? "TOP_RATED"
        : "ESTABLISHED",
    rating: rounded,
    reviewCount,
    label: `${rounded.toFixed(1)} (${reviewCount} ${noun})`,
  };
}
