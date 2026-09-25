import { applyBps } from "./pricing";
import { CARD_PROCESSING_FEE_BPS } from "./settlement";

/**
 * The cancellation policy: when a customer can cancel for free, what a late
 * cancellation or a missed appointment costs, and how that fee is split.
 *
 * Pure: no database, no gateway. The booking page previews exactly what the
 * cancel endpoint will charge, because both call quoteCustomerCancellation.
 *
 * Why these numbers. UK beauty platforms let the business set a window of
 * 24–72 hours and charge up to the full price inside it; 24 hours with half
 * the service price is at the customer-friendly end. Under the Consumer
 * Rights Act a cancellation charge has to be a fair estimate of what the
 * business actually loses, not a penalty. Inside a day a vendor can rarely
 * refill the slot, so half the service price is a fair estimate; a missed
 * appointment, where they have kept the time free and (for a home visit)
 * travelled, loses them the whole job. The trust fee and any tip are never
 * part of a fee.
 */

const HOUR_MS = 60 * 60 * 1_000;
const MINUTE_MS = 60 * 1_000;

/** Free cancellation up to this long before the appointment. */
export const FREE_CANCELLATION_HOURS = 24;

/** A late cancellation costs this share of the service price. */
export const LATE_CANCELLATION_FEE_BPS = 5_000;

/** A missed appointment costs this share of the service price, plus travel. */
export const NO_SHOW_FEE_BPS = 10_000;

/**
 * A change of mind straight after booking is free, even for an appointment
 * less than a day away: the vendor has barely had time to plan around it.
 * Ends early if the vendor has already set off.
 */
export const BOOKING_GRACE_MINUTES = 15;

/** How long a vendor waits past the start time before calling a no-show. */
export const NO_SHOW_WAIT_MINUTES = 15;

/** Nobody has committed to the booking yet, so leaving costs nothing. */
const UNCOMMITTED = ["REQUESTED", "BROADCAST"];

/** A vendor is booked but has not set off. */
const BOOKED = ["ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED"];

/** Statuses from which a vendor may cancel a job (free for the customer). */
export const PROVIDER_CANCELLABLE = ["ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED", "PROVIDER_EN_ROUTE"];

export interface FeeBooking {
  appointmentStartAt: Date;
  bookingCreatedAt: Date;
  status: string;
  serviceLocation: string;
  subtotalMinor: number;
  emergencySurchargeMinor: number;
  otherSurchargesMinor: number;
  travelFeeMinor: number;
  totalInvoicePriceMinor: number;
  tipMinor: number;
  discountMinor: number;
}

/** When free cancellation ends. */
export function freeCancellationEndsAt(appointmentStartAt: Date): Date {
  return new Date(appointmentStartAt.getTime() - FREE_CANCELLATION_HOURS * HOUR_MS);
}

/** When the after-booking grace period ends. */
export function graceEndsAt(bookingCreatedAt: Date): Date {
  return new Date(bookingCreatedAt.getTime() + BOOKING_GRACE_MINUTES * MINUTE_MS);
}

/** The work itself: services, add-ons and surcharges. Not travel, not the trust fee. */
export function serviceValueMinor(booking: Pick<FeeBooking, "subtotalMinor" | "emergencySurchargeMinor" | "otherSurchargesMinor">) {
  return booking.subtotalMinor + booking.emergencySurchargeMinor + booking.otherSurchargesMinor;
}

/** Never more than the card is actually charged for the booking. */
function capped(booking: FeeBooking, feeMinor: number): number {
  const chargeMinor = booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor;
  return Math.max(0, Math.min(feeMinor, chargeMinor));
}

/** Travel counted in a fee: only for a home visit. */
function travelMinor(booking: FeeBooking): number {
  return booking.serviceLocation === "CUSTOMER_ADDRESS" ? booking.travelFeeMinor : 0;
}

export function lateCancellationFeeMinor(booking: FeeBooking): number {
  return capped(booking, applyBps(serviceValueMinor(booking), LATE_CANCELLATION_FEE_BPS));
}

export function noShowFeeMinor(booking: FeeBooking): number {
  return capped(booking, applyBps(serviceValueMinor(booking), NO_SHOW_FEE_BPS) + travelMinor(booking));
}

export type CancellationKind = "FREE" | "LATE" | "MISSED";

export type CancellationQuote =
  | {
      allowed: true;
      kind: CancellationKind;
      feeMinor: number;
      /** Free cancellation ends (null once a vendor isn't yet involved). */
      freeUntil: Date | null;
      /** One line for the customer, saying what cancelling now costs and why. */
      explanation: string;
    }
  | { allowed: false; explanation: string };

/**
 * What it costs the customer to cancel right now.
 *
 *   no vendor yet                        → free
 *   more than 24h before, or within 15
 *   minutes of booking                   → free
 *   inside 24h                           → half the service price
 *   vendor on the way, or start time
 *   passed                               → as a missed appointment
 *   vendor at the door or later          → not in the app; contact support
 */
export function quoteCustomerCancellation(booking: FeeBooking, now = new Date()): CancellationQuote {
  if (UNCOMMITTED.includes(booking.status)) {
    return { allowed: true, kind: "FREE", feeMinor: 0, freeUntil: null, explanation: "No vendor has taken this on yet, so cancelling is free." };
  }

  const freeUntil = freeCancellationEndsAt(booking.appointmentStartAt);
  const started = now.getTime() >= booking.appointmentStartAt.getTime();

  if (booking.status === "PROVIDER_EN_ROUTE" || (BOOKED.includes(booking.status) && started)) {
    return {
      allowed: true,
      kind: "MISSED",
      feeMinor: noShowFeeMinor(booking),
      freeUntil,
      explanation:
        booking.status === "PROVIDER_EN_ROUTE"
          ? "Your vendor is already on the way, so cancelling now is charged as a missed appointment."
          : "Your appointment time has passed, so cancelling now is charged as a missed appointment.",
    };
  }

  if (!BOOKED.includes(booking.status)) {
    return {
      allowed: false,
      explanation:
        booking.status === "ARRIVED" || booking.status === "IN_PROGRESS"
          ? "Your appointment has started. If something is wrong, contact us and we'll help."
          : "This booking can no longer be cancelled.",
    };
  }

  if (now.getTime() < freeUntil.getTime() || now.getTime() < graceEndsAt(booking.bookingCreatedAt).getTime()) {
    return {
      allowed: true,
      kind: "FREE",
      feeMinor: 0,
      freeUntil,
      explanation: "Cancelling now is free, and the hold on your card is released in full.",
    };
  }

  return {
    allowed: true,
    kind: "LATE",
    feeMinor: lateCancellationFeeMinor(booking),
    freeUntil,
    explanation: "It's less than 24 hours to your appointment, so cancelling now costs half the service price.",
  };
}

/**
 * Whether the vendor may mark the customer as a no-show.
 *
 * At a home visit the vendor must have marked themselves arrived; at their
 * own workspace, the client must not have been checked in. Either way they
 * wait fifteen minutes past the later of the start time and their own
 * arrival, so a vendor who turns up late can't call a no-show on arrival.
 */
export function noShowAllowedFrom(
  booking: Pick<FeeBooking, "status" | "serviceLocation" | "appointmentStartAt">,
  arrivedAt: Date | null,
): Date | null {
  const expected = booking.serviceLocation === "VENDOR_PREMISES" ? "CONFIRMED" : "ARRIVED";
  if (booking.status !== expected) return null;
  const from = Math.max(booking.appointmentStartAt.getTime(), arrivedAt?.getTime() ?? 0);
  return new Date(from + NO_SHOW_WAIT_MINUTES * MINUTE_MS);
}

/**
 * The vendor's share of a fee, split the same way as a completed booking:
 * commission on the service part, travel passed on in full, and the card
 * fee on direct and repeat bookings (Rule A).
 */
export function vendorShareOfFeeMinor(input: {
  feeMinor: number;
  /** Travel included in the fee (a no-show at a home visit). */
  travelInFeeMinor: number;
  commissionBps: number;
  firstDiscoveryBooking: boolean;
}): number {
  const travel = Math.min(input.travelInFeeMinor, input.feeMinor);
  const commission = applyBps(input.feeMinor - travel, input.commissionBps);
  const processing = input.firstDiscoveryBooking ? 0 : applyBps(input.feeMinor, CARD_PROCESSING_FEE_BPS);
  return Math.max(0, input.feeMinor - commission - processing);
}

/** Travel included in a missed-appointment fee, for the split above. */
export function travelInNoShowFeeMinor(booking: FeeBooking): number {
  return Math.min(travelMinor(booking), noShowFeeMinor(booking));
}

/** The policy in one sentence, for checkout and emails. */
export function policySummary(): string {
  return `Free cancellation up to ${FREE_CANCELLATION_HOURS} hours before your appointment. After that, cancelling costs ${LATE_CANCELLATION_FEE_BPS / 100}% of the service price, and a missed appointment is charged in full.`;
}
