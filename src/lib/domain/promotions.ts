/**
 * Paid promotions: placements a vendor buys for a fixed number of days.
 *
 * Modelled on classified-ad bump-ups rather than an auction: a fixed price
 * per package, a fixed number of slots, first come first served. A vendor
 * always knows what they pay and when it runs, and the slot cap keeps a
 * placement worth having — five "top of search" spots would mean none of
 * them is the top.
 *
 * Where each placement shows is code, so the keys are fixed here; prices,
 * slot counts and whether each is on sale are the admin's (PromotionProduct).
 */

export const PROMOTION_KEYS = ["SEARCH_TOP", "DIRECTORY_FEATURED", "HOME_SPOTLIGHT"] as const;
export type PromotionKey = (typeof PROMOTION_KEYS)[number];

/** CITY placements are sold per city; NATIONAL ones once, UK-wide. */
export const PROMOTION_SCOPE: Record<PromotionKey, "CITY" | "NATIONAL"> = {
  SEARCH_TOP: "CITY",
  DIRECTORY_FEATURED: "CITY",
  HOME_SPOTLIGHT: "NATIONAL",
};

/** Where it shows, for the vendor deciding what to buy. */
export const PROMOTION_WHERE: Record<PromotionKey, string> = {
  SEARCH_TOP: "Search results",
  DIRECTORY_FEATURED: "Salon directory and map",
  HOME_SPOTLIGHT: "Home page",
};

/** The package lengths sold, in days. */
export const PROMOTION_DAYS = [7, 14, 30] as const;
export type PromotionDays = (typeof PROMOTION_DAYS)[number];

/** How far ahead a purchase may be queued when every slot is taken. */
export const MAX_QUEUE_DAYS = 90;

/** How long an unpaid checkout keeps its slot. Stripe's own minimum is 30 minutes. */
export const CHECKOUT_HOLD_MINUTES = 40;

const DAY_MS = 86_400_000;

export function isPromotionKey(value: string): value is PromotionKey {
  return (PROMOTION_KEYS as readonly string[]).includes(value);
}

export function isPromotionDays(value: number): value is PromotionDays {
  return (PROMOTION_DAYS as readonly number[]).includes(value);
}

export interface PriceList {
  price7Minor: number;
  price14Minor: number;
  price30Minor: number;
}

/** The price of a package in pence, or null when that length is not sold. */
export function promotionPrice(product: PriceList, days: number): number | null {
  const price =
    days === 7 ? product.price7Minor : days === 14 ? product.price14Minor : days === 30 ? product.price30Minor : 0;
  return price > 0 ? price : null;
}

/** The area a purchase competes in: the vendor's city, or "" for national. */
export function promotionArea(key: PromotionKey, vendorCity: string): string {
  return PROMOTION_SCOPE[key] === "CITY" ? vendorCity.trim() : "";
}

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

/** How many of `taken` overlap the instant `at`. Windows are [start, end). */
function occupancyAt(taken: Interval[], at: number): number {
  return taken.filter((slot) => slot.startsAt.getTime() <= at && at < slot.endsAt.getTime()).length;
}

/** Whether a new window fits beside `taken` without exceeding `capacity` at any moment. */
export function fits(taken: Interval[], capacity: number, startsAt: Date, endsAt: Date): boolean {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  // Occupancy only rises where a window starts, so checking the new start
  // and every start inside the new window covers every moment.
  const points = [start, ...taken.map((slot) => slot.startsAt.getTime()).filter((at) => at > start && at < end)];
  return points.every((at) => occupancyAt(taken, at) < capacity);
}

/**
 * The earliest start for a `days`-long window, at or after `notBefore`, that
 * keeps the placement within its slot count — or null when nothing frees up
 * within MAX_QUEUE_DAYS.
 *
 * `taken` is everyone's holding windows in that area (paid and still-held
 * checkouts). `notBefore` is now, or the end of the vendor's own current run,
 * so buying again extends rather than doubles up.
 */
export function earliestPromotionStart(input: {
  taken: Interval[];
  capacity: number;
  days: number;
  notBefore: Date;
}): Date | null {
  if (input.capacity < 1) return null;
  const length = input.days * DAY_MS;
  const floor = input.notBefore.getTime();
  // A slot only frees up when a window ends, so those are the only starts
  // worth trying after the floor.
  const candidates = [
    floor,
    ...input.taken.map((slot) => slot.endsAt.getTime()).filter((at) => at > floor),
  ].sort((a, b) => a - b);

  for (const candidate of candidates) {
    if (candidate - floor > MAX_QUEUE_DAYS * DAY_MS) return null;
    if (fits(input.taken, input.capacity, new Date(candidate), new Date(candidate + length))) {
      return new Date(candidate);
    }
  }
  return null;
}

/** Slots free right now, never below zero. */
export function slotsFreeNow(taken: Interval[], capacity: number, now: Date): number {
  return Math.max(0, capacity - occupancyAt(taken, now.getTime()));
}

export function promotionEnd(startsAt: Date, days: number): Date {
  return new Date(startsAt.getTime() + days * DAY_MS);
}

export type PromotionState = "PENDING" | "SCHEDULED" | "LIVE" | "ENDED" | "EXPIRED" | "CANCELLED" | "REFUNDED";

/** What a purchase is doing now, for the vendor's and admin's lists. */
export function promotionState(
  promotion: { status: string; startsAt: Date; endsAt: Date },
  now = new Date(),
): PromotionState {
  if (promotion.status === "PAID") {
    if (promotion.endsAt <= now) return "ENDED";
    return promotion.startsAt > now ? "SCHEDULED" : "LIVE";
  }
  if (promotion.status === "EXPIRED" || promotion.status === "CANCELLED" || promotion.status === "REFUNDED") {
    return promotion.status;
  }
  return "PENDING";
}

/**
 * Up to `limit` of the promoted ids, in a fresh order each time: equal
 * buyers of a placement get equal turns at its first position.
 */
export function rotate<T>(items: T[], limit: number, random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
}
