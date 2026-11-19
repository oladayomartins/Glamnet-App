import { applyBps, DEFAULT_PROVIDER_COMMISSION_BPS } from "./pricing";
import { DEFAULT_EMERGENCY_THRESHOLD_MINUTES } from "./constants";

/**
 * "Make an Offer" — customer-initiated price negotiation on a vendor's listed
 * service price.
 *
 * Naming note: this codebase already uses "offer" twice — `offer-list.tsx` is a
 * vendor offering to fulfil a broadcast, and `Promotion` is a paid placement.
 * Customer price negotiation is therefore modelled as a *PriceOffer* in code,
 * and only ever called "Make an Offer" in customer-facing copy.
 *
 * Three rules hold the feature inside the existing money model:
 *
 *  1. **The vendor absorbs the discount, not the platform.** The vendor chooses
 *     to accept a lower price, so the platform's absolute cut of the service
 *     work is unchanged by the negotiation. See `platformServiceCutMinor`.
 *  2. **The trust fee and the emergency surcharge are never negotiable.** They
 *     are platform rules, not part of the vendor's asking price.
 *  3. **An offer lapses when the appointment enters the emergency window.**
 *     Booking type is classified server-side at creation (spec §9); an offer
 *     accepted inside the window would reclassify the booking and add a
 *     surcharge the customer never agreed to. Expiring the offer instead keeps
 *     the emergency rule intact and never surprises anyone with a bill.
 */

export const PRICE_OFFER_STATUSES = [
  "PENDING",
  "COUNTERED",
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

export type PriceOfferStatus = (typeof PRICE_OFFER_STATUSES)[number];

/** Statuses from which an offer can still move somewhere useful. */
export const OPEN_PRICE_OFFER_STATUSES: readonly PriceOfferStatus[] = [
  "PENDING",
  "COUNTERED",
];

/** Terminal statuses: nothing follows them. */
export const CLOSED_PRICE_OFFER_STATUSES: readonly PriceOfferStatus[] = [
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
];

/** How long an offer stands before it lapses, absent an earlier boundary. */
export const PRICE_OFFER_VALIDITY_HOURS = 24;

/**
 * Floor guard expressed as a share of the listed price, in basis points.
 *
 * The hard floor is the platform's cut (below it the vendor would earn nothing
 * or less), but a vendor should not be shown a derisory offer at all, so the
 * engine also refuses anything under this share. 50% by default.
 */
export const MIN_PRICE_OFFER_BPS = 5_000;

/** Who moved the offer last — drives whose turn it is in the UI. */
export type PriceOfferActor = "CUSTOMER" | "PROVIDER";

export interface PriceOfferTransition {
  from: PriceOfferStatus;
  to: PriceOfferStatus;
  by: PriceOfferActor;
}

/**
 * Legal transitions. A counter-offer flips the turn, so the pair
 * PENDING -> COUNTERED (provider) and COUNTERED -> PENDING (customer) can
 * repeat until somebody accepts, declines, withdraws, or the clock runs out.
 */
const ALLOWED_TRANSITIONS: readonly PriceOfferTransition[] = [
  { from: "PENDING", to: "ACCEPTED", by: "PROVIDER" },
  { from: "PENDING", to: "DECLINED", by: "PROVIDER" },
  { from: "PENDING", to: "COUNTERED", by: "PROVIDER" },
  { from: "PENDING", to: "WITHDRAWN", by: "CUSTOMER" },
  { from: "COUNTERED", to: "ACCEPTED", by: "CUSTOMER" },
  { from: "COUNTERED", to: "DECLINED", by: "CUSTOMER" },
  { from: "COUNTERED", to: "PENDING", by: "CUSTOMER" },
  { from: "COUNTERED", to: "WITHDRAWN", by: "PROVIDER" },
];

export function isPriceOfferOpen(status: PriceOfferStatus): boolean {
  return OPEN_PRICE_OFFER_STATUSES.includes(status);
}

/** Whose turn it is, or null once the offer is closed. */
export function priceOfferTurn(status: PriceOfferStatus): PriceOfferActor | null {
  if (status === "PENDING") return "PROVIDER";
  if (status === "COUNTERED") return "CUSTOMER";
  return null;
}

export function canTransitionPriceOffer(
  from: PriceOfferStatus,
  to: PriceOfferStatus,
  by: PriceOfferActor,
): boolean {
  return ALLOWED_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.by === by,
  );
}

/**
 * The platform's absolute cut of the service work at the *listed* price.
 *
 * This is the number the negotiation must not touch. At a 70% vendor share and
 * a £100 listed subtotal the platform keeps £30; if the customer's £80 offer is
 * accepted the platform still keeps £30 and the vendor takes £50 rather than
 * £70. The vendor gave the discount, so the vendor pays for it.
 */
export function platformServiceCutMinor(
  listedSubtotalMinor: number,
  providerCommissionBps: number = DEFAULT_PROVIDER_COMMISSION_BPS,
): number {
  return listedSubtotalMinor - applyBps(listedSubtotalMinor, providerCommissionBps);
}

/**
 * The lowest offer the engine will accept on a listed subtotal: the greater of
 * the platform's cut (so the vendor never earns nothing) and the minimum share
 * guard (so vendors are not pestered with insulting offers).
 */
export function priceOfferFloorMinor(
  listedSubtotalMinor: number,
  providerCommissionBps: number = DEFAULT_PROVIDER_COMMISSION_BPS,
  minOfferBps: number = MIN_PRICE_OFFER_BPS,
): number {
  return Math.max(
    platformServiceCutMinor(listedSubtotalMinor, providerCommissionBps),
    applyBps(listedSubtotalMinor, minOfferBps),
  );
}

/**
 * The moment an offer stops being acceptable: the earlier of its own validity
 * window and the emergency threshold boundary for the appointment.
 *
 * Rule 3 above. If the appointment is already inside the emergency window the
 * returned instant is `createdAt`, which makes the offer dead on arrival —
 * callers should refuse to create it (see `validatePriceOffer`).
 */
export function priceOfferExpiresAt(input: {
  createdAt: Date;
  appointmentStartAt: Date;
  thresholdMinutes?: number;
  validityHours?: number;
}): Date {
  const {
    createdAt,
    appointmentStartAt,
    thresholdMinutes = DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
    validityHours = PRICE_OFFER_VALIDITY_HOURS,
  } = input;

  const validityEnd = new Date(
    createdAt.getTime() + validityHours * 60 * 60 * 1000,
  );
  const emergencyBoundary = new Date(
    appointmentStartAt.getTime() - thresholdMinutes * 60 * 1000,
  );

  const earliest = Math.min(validityEnd.getTime(), emergencyBoundary.getTime());
  return new Date(Math.max(earliest, createdAt.getTime()));
}

export function isPriceOfferExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export type PriceOfferRejection =
  | "NOT_ACCEPTING_OFFERS"
  | "INSIDE_EMERGENCY_WINDOW"
  | "NOT_BELOW_LISTED"
  | "BELOW_FLOOR"
  | "NOT_AN_AMOUNT";

export interface PriceOfferValidation {
  ok: boolean;
  reason?: PriceOfferRejection;
  /** Populated when ok: the floor used, and when the offer would lapse. */
  floorMinor?: number;
  expiresAt?: Date;
}

/**
 * Whether an offer may be created at all. Checked server-side on every request
 * — the vendor's toggle and the emergency boundary are both authorisation
 * rules, not UI hints.
 */
export function validatePriceOffer(input: {
  listedSubtotalMinor: number;
  proposedSubtotalMinor: number;
  acceptsOffers: boolean;
  createdAt: Date;
  appointmentStartAt: Date;
  thresholdMinutes?: number;
  providerCommissionBps?: number;
  minOfferBps?: number;
  validityHours?: number;
}): PriceOfferValidation {
  const {
    listedSubtotalMinor,
    proposedSubtotalMinor,
    acceptsOffers,
    createdAt,
    appointmentStartAt,
    thresholdMinutes = DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
    providerCommissionBps = DEFAULT_PROVIDER_COMMISSION_BPS,
    minOfferBps = MIN_PRICE_OFFER_BPS,
    validityHours = PRICE_OFFER_VALIDITY_HOURS,
  } = input;

  if (!acceptsOffers) return { ok: false, reason: "NOT_ACCEPTING_OFFERS" };

  if (
    !Number.isFinite(proposedSubtotalMinor) ||
    !Number.isInteger(proposedSubtotalMinor) ||
    proposedSubtotalMinor <= 0
  ) {
    return { ok: false, reason: "NOT_AN_AMOUNT" };
  }

  const noticeMinutes =
    (appointmentStartAt.getTime() - createdAt.getTime()) / 60_000;
  if (noticeMinutes <= thresholdMinutes) {
    return { ok: false, reason: "INSIDE_EMERGENCY_WINDOW" };
  }

  if (proposedSubtotalMinor >= listedSubtotalMinor) {
    return { ok: false, reason: "NOT_BELOW_LISTED" };
  }

  const floorMinor = priceOfferFloorMinor(
    listedSubtotalMinor,
    providerCommissionBps,
    minOfferBps,
  );
  if (proposedSubtotalMinor < floorMinor) {
    return { ok: false, reason: "BELOW_FLOOR", floorMinor };
  }

  return {
    ok: true,
    floorMinor,
    expiresAt: priceOfferExpiresAt({
      createdAt,
      appointmentStartAt,
      thresholdMinutes,
      validityHours,
    }),
  };
}

/** Customer-facing wording for a refusal. Never leaks the floor arithmetic. */
export function priceOfferRejectionMessage(
  reason: PriceOfferRejection,
  floorMinor?: number,
  formatMoney?: (minor: number) => string,
): string {
  switch (reason) {
    case "NOT_ACCEPTING_OFFERS":
      return "This vendor is not taking offers at the moment.";
    case "INSIDE_EMERGENCY_WINDOW":
      return "Offers close 12 hours before the appointment. Book at the listed price instead.";
    case "NOT_BELOW_LISTED":
      return "Your offer needs to be below the listed price.";
    case "BELOW_FLOOR":
      return floorMinor != null && formatMoney
        ? `The lowest offer this vendor can consider is ${formatMoney(floorMinor)}.`
        : "That offer is too low for this vendor to consider.";
    case "NOT_AN_AMOUNT":
      return "Enter an offer amount.";
  }
}
