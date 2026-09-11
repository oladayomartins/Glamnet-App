import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { NEXT_STATUS, type AnyBookingStatus, type BookingStatus } from "@/lib/domain/types";

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
 * disputed. Nothing may move backwards.
 */
export function canTransition(
  from: AnyBookingStatus,
  to: AnyBookingStatus,
): boolean {
  if (to === "CANCELLED") return CANCELLABLE.includes(from);
  if (to === "DISPUTED") {
    return from === "COMPLETED" || from === "REVIEWED" || from === "PAYMENT_RELEASED";
  }
  if (!isLifecycleStatus(from)) return false;
  return NEXT_STATUS[from] === to;
}

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
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const from = booking.status as AnyBookingStatus;
    if (!canTransition(from, to)) {
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
        // The address is released to the provider only at this step.
        ...(to === "ADDRESS_UNLOCKED" ? { addressUnlocked: true } : {}),
        ...(to === "CANCELLED" ? { cancelledReason: note } : {}),
      },
    });

    await tx.bookingStatusEvent.create({
      data: { bookingId, fromStatus: from, toStatus: to, actor, note },
    });

    // Completing a job credits the provider's record, which feeds match ranking.
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
}

/** Record a customer rating and move the booking to REVIEWED. */
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
