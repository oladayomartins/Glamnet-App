import { HOLD_LEAD_DAYS } from "./payment-rules";

/**
 * The rules for moving a booking to a new time. Pure, so the booking page,
 * the API and the tests all read the same thing.
 *
 * Either side may suggest a new time; it only moves when the other side
 * accepts. The price, the emergency classification and the commission stay
 * as booked: a reschedule is the same booking at a different hour, not a new
 * sale.
 */

/** Statuses in which the appointment can still move: nobody has set off. */
export const RESCHEDULABLE_STATUSES = ["ACCEPTED", "CONFIRMED"] as const;

/** A booking can be moved this many times; after that, cancel and rebook. */
export const MAX_RESCHEDULES = 3;

/** The new time must be at least this far away when suggested and accepted. */
export const RESCHEDULE_MIN_NOTICE_MINUTES = 60;

/** How far ahead a new time may be. */
export const RESCHEDULE_DAYS_AHEAD = 28;

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface ReschedulableBooking {
  status: string;
  paymentStatus: string;
  providerId: string | null;
  appointmentStartAt: Date;
  holdAuthorisedAt: Date | null;
  rescheduleCount: number;
}

/** Why this booking can't be moved at all right now, or null if it can. */
export function rescheduleBlocker(booking: ReschedulableBooking): string | null {
  if (!booking.providerId) return "There's no vendor on this booking yet.";
  if (!(RESCHEDULABLE_STATUSES as readonly string[]).includes(booking.status)) {
    return "This booking can no longer be moved.";
  }
  if (booking.paymentStatus !== "AUTHORISED" && booking.paymentStatus !== "CARD_SAVED") {
    return "The card for this booking needs to be in place before it can be moved.";
  }
  if (booking.rescheduleCount >= MAX_RESCHEDULES) {
    return `This booking has already been moved ${MAX_RESCHEDULES} times. Cancel it and book again instead.`;
  }
  return null;
}

/**
 * The latest start a held card can cover. Stripe drops an uncaptured hold
 * after about seven days, and a hold is placed five days out; a new time
 * past that would leave the appointment unpaid. Null when there is no live
 * hold (a saved card is held later, whenever the date is).
 */
export function latestStartForHold(booking: ReschedulableBooking): Date | null {
  if (booking.paymentStatus !== "AUTHORISED") return null;
  const heldAt = booking.holdAuthorisedAt ?? booking.appointmentStartAt;
  return new Date(heldAt.getTime() + HOLD_LEAD_DAYS * DAY_MS);
}

/** Why `startAt` can't be the new time (beyond the vendor's diary), or null. */
export function newTimeProblem(
  booking: ReschedulableBooking,
  startAt: Date,
  now = new Date(),
): string | null {
  if (startAt.getTime() === booking.appointmentStartAt.getTime()) {
    return "That's the time already booked.";
  }
  if (startAt.getTime() < now.getTime() + RESCHEDULE_MIN_NOTICE_MINUTES * 60_000) {
    return "Choose a time at least an hour from now.";
  }
  if (startAt.getTime() > now.getTime() + RESCHEDULE_DAYS_AHEAD * DAY_MS) {
    return `Choose a time within the next ${RESCHEDULE_DAYS_AHEAD} days.`;
  }
  const latest = latestStartForHold(booking);
  if (latest && startAt.getTime() > latest.getTime()) {
    return "The payment hold for this booking can't stretch that far. Choose an earlier day, or cancel and book again.";
  }
  return null;
}
