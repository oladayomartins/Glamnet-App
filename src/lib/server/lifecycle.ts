import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import {
  NEXT_STATUS,
  nextStatusFor,
  type AnyBookingStatus,
  type BookingStatus,
} from "@/lib/domain/types";
import { voidPaymentForBooking } from "./escrow";

/** Statuses a booking may be cancelled from. */
const CANCELLABLE: AnyBookingStatus[] = [
  "REQUESTED",
  "BROADCAST",
  "ACCEPTED",
  "CONFIRMED",
  "ADDRESS_UNLOCKED",
  "PROVIDER_EN_ROUTE",
];

function isLifecycleStatus(status: string): status is BookingStatus {
  return status in NEXT_STATUS;
}

/**
 * Whether `to` is a legal transition from `from`.
 *
 * The lifecycle is strictly linear (spec §8) with two escapes: any booking that
 * has not yet started may be cancelled, and a completed booking may be
 * disputed. Nothing may move backwards. A booking at the vendor's own
 * premises skips the address and travel steps, which have no meaning there.
 *
 * The 24-hour limit on disputes is a matter of time, not of status, and is
 * enforced by the dispute service rather than here.
 */
export function canTransition(
  from: AnyBookingStatus,
  to: AnyBookingStatus,
  serviceLocation = "CUSTOMER_ADDRESS",
): boolean {
  if (to === "CANCELLED") return CANCELLABLE.includes(from);
  if (to === "DISPUTED") {
    return from === "COMPLETED" || from === "REVIEWED" || from === "PAYMENT_RELEASED";
  }
  if (!isLifecycleStatus(from)) return false;
  return nextStatusFor(from, serviceLocation) === to;
}

// Re-exported for callers that only need the plain chain.
export { NEXT_STATUS };

/**
 * Advance a booking's operational status. The booking's NORMAL/EMERGENCY
 * classification is never touched here — it is fixed at creation and retained
 * through completion (spec §8).
 */
export async function transitionBooking(
  bookingId: string,
  to: AnyBookingStatus,
  actor: string,
  note = "",
) {
  const updated = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const from = booking.status as AnyBookingStatus;
    if (!canTransition(from, to, booking.serviceLocation)) {
      throw new BookingError(
        `Cannot move a booking from ${from} to ${to}.`,
        "INVALID_TRANSITION",
        409,
      );
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: to,
        // The address is released to the vendor only at this step.
        ...(to === "ADDRESS_UNLOCKED" ? { addressUnlocked: true } : {}),
        ...(to === "CANCELLED" ? { cancelledReason: note } : {}),
        ...(to === "DISPUTED"
          ? { settlementStatus: "DISPUTED", disputeReason: note, disputedAt: new Date() }
          : {}),
      },
    });

    await tx.bookingStatusEvent.create({
      data: { bookingId, fromStatus: from, toStatus: to, actor, note },
    });

    // Completing a job credits the vendor's record, which feeds match ranking.
    if (to === "COMPLETED" && booking.providerId) {
      await tx.provider.update({
        where: { id: booking.providerId },
        data: { completedBookings: { increment: 1 } },
      });
    }

    // A cancellation releases the calendar hold and closes any open invitations.
    if (to === "CANCELLED") {
      await tx.bookingBroadcast.updateMany({
        where: { bookingId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    }

    return updated;
  });

  // After the commit: a cancelled booking lets go of the card hold. A failed
  // void is logged, not thrown — the cancellation itself stands, and an
  // uncaptured hold lapses on its own.
  if (to === "CANCELLED") await voidPaymentForBooking(updated);

  return updated;
}

/**
 * Record a customer rating and move the booking to REVIEWED.
 *
 * Reviews follow the release of payment; they no longer gate it. The review
 * log is append-only from the customer's side: once written it cannot be
 * edited, because REVIEWED has no way back to PAYMENT_RELEASED.
 */
export async function reviewBooking(
  bookingId: string,
  rating: number,
  note = "",
  actor = "CUSTOMER",
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BookingError("Rating must be a whole number from 1 to 5.", "INVALID_TRANSITION");
  }
  await transitionBooking(bookingId, "REVIEWED", actor, `Rated ${rating}/5.`);
  return prisma.booking.update({
    where: { id: bookingId },
    data: { rating, reviewNote: note.trim() },
  });
}
