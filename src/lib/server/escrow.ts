import { randomInt } from "node:crypto";
import type { Booking } from "@prisma/client";
import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { paymentGateway, PaymentError } from "./payments";
import { holdSavedCard } from "./payment-flow";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import {
  canDispute,
  disputeWindowClosesAt,
  formatPin,
  isWellFormedPin,
  MAX_PIN_ATTEMPTS,
  pinMatches,
  REQUIRED_COMPLETION_PHOTOS,
} from "@/lib/domain/completion";

/**
 * The escrow loop (Open Marketplace Directory §D, Flow 2): card hold at
 * checkout, three completion photos, a 4-digit PIN on the customer's screen,
 * release on a match, and a 24-hour dispute window after.
 *
 * Every step checks who is asking. The PIN in particular is only ever read by
 * the customer's own booking page — no vendor-facing query selects it.
 */

/** Whether this customer already has a real booking with this vendor. */
export async function hasPriorBooking(
  customerId: string,
  providerId: string,
  excludeBookingId?: string,
): Promise<boolean> {
  const prior = await prisma.booking.findFirst({
    where: {
      customerId,
      providerId,
      status: { in: [...CALENDAR_HOLDING_STATUSES] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true },
  });
  return prior !== null;
}

/**
 * Release the card hold on a cancelled booking. Never throws: the
 * cancellation stands either way, and an uncaptured hold lapses on its own.
 * A card only saved for later has nothing to release; it is simply not used.
 */
export async function voidPaymentForBooking(booking: Booking): Promise<void> {
  if (booking.paymentStatus === "CARD_SAVED" || booking.paymentStatus === "AUTHORISATION_FAILED") {
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "VOIDED" } });
    return;
  }
  if (
    !booking.paymentIntentId ||
    (booking.paymentStatus !== "AUTHORISED" &&
      booking.paymentStatus !== "PENDING_AUTHORISATION")
  ) {
    return;
  }
  try {
    await paymentGateway().void(booking.paymentIntentId);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: "VOIDED" },
    });
  } catch (error) {
    console.error("Could not void the card hold", booking.id, error);
  }
}

async function loadProviderJob(bookingId: string, providerId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.providerId !== providerId) {
    throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  }
  return booking;
}

/**
 * [ Request Checkout Release ] — the vendor finishes the job.
 *
 * Requires exactly three photos of the finished work (the visual audit
 * trail), moves the booking to COMPLETED and issues the customer's PIN.
 */
export async function requestCheckoutRelease(
  bookingId: string,
  providerId: string,
  photos: { url: string; fileId: string }[],
  now = new Date(),
) {
  if (photos.length !== REQUIRED_COMPLETION_PHOTOS) {
    throw new BookingError(
      `Upload ${REQUIRED_COMPLETION_PHOTOS} photos of the finished work first.`,
      "INVALID_TRANSITION",
      422,
    );
  }

  const booking = await loadProviderJob(bookingId, providerId);
  if (booking.status !== "IN_PROGRESS") {
    throw new BookingError(
      "Only an appointment in progress can be finished.",
      "INVALID_TRANSITION",
      409,
    );
  }

  const pin = formatPin(randomInt(0, 10_000));

  return prisma.$transaction(async (tx) => {
    // Guarded on status so a double tap cannot issue two PINs.
    const claimed = await tx.booking.updateMany({
      where: { id: bookingId, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        completionPin: pin,
        completionPinIssuedAt: now,
        completionPinAttempts: 0,
      },
    });
    if (claimed.count === 0) {
      throw new BookingError("This job has already been finished.", "INVALID_TRANSITION", 409);
    }

    await tx.bookingCompletionPhoto.createMany({
      data: photos.map((photo, position) => ({
        bookingId,
        url: photo.url,
        fileId: photo.fileId,
        position,
      })),
    });
    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        actor: "PROVIDER",
        note: `Checkout release requested with ${photos.length} photos; PIN issued.`,
      },
    });
    await tx.provider.update({
      where: { id: providerId },
      data: { completedBookings: { increment: 1 } },
    });
    await tx.notification.create({
      data: {
        bookingId,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: "Your checkout PIN is ready",
        // The PIN is deliberately not in the notification body: a lock-screen
        // preview is readable by whoever is holding the phone.
        body: "Open your booking to see the 4-digit PIN, and read it to your vendor if you are happy.",
      },
    });

    return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  });
}

/** Burn the old PIN and issue a new one, e.g. after too many wrong tries. */
export async function reissuePin(bookingId: string, providerId: string, now = new Date()) {
  const booking = await loadProviderJob(bookingId, providerId);
  if (booking.status !== "COMPLETED") {
    throw new BookingError("There is no PIN to reissue.", "INVALID_TRANSITION", 409);
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      completionPin: formatPin(randomInt(0, 10_000)),
      completionPinIssuedAt: now,
      completionPinAttempts: 0,
    },
  });
}

/**
 * The vendor types in the customer's PIN. A match captures the hold, pays the
 * vendor's connected account, and opens the 24-hour dispute window.
 */
export async function releaseWithPin(
  bookingId: string,
  providerId: string,
  pin: string,
  now = new Date(),
) {
  if (!isWellFormedPin(pin)) {
    throw new BookingError("Enter the 4-digit PIN.", "INVALID_TRANSITION", 422);
  }

  const booking = await loadProviderJob(bookingId, providerId);
  if (booking.status !== "COMPLETED" || !booking.completionPin) {
    throw new BookingError("This job is not waiting for a PIN.", "INVALID_TRANSITION", 409);
  }
  if (booking.completionPinAttempts >= MAX_PIN_ATTEMPTS) {
    throw new BookingError(
      "Too many wrong attempts. Issue a new PIN to the customer.",
      "INVALID_TRANSITION",
      429,
    );
  }

  if (!pinMatches(booking.completionPin, pin)) {
    const attempts = booking.completionPinAttempts + 1;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { completionPinAttempts: attempts },
    });
    const left = MAX_PIN_ATTEMPTS - attempts;
    throw new BookingError(
      left > 0
        ? `That PIN is not right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "That PIN is not right, and that was the last try. Issue a new PIN.",
      "INVALID_TRANSITION",
      422,
    );
  }

  if (booking.paymentStatus === "AUTHORISATION_FAILED" || booking.paymentStatus === "PENDING_AUTHORISATION") {
    throw new BookingError(
      "The client's card isn't secured yet. We've asked them to update it; the PIN will work once they have.",
      "INVALID_TRANSITION",
      402,
    );
  }

  // A saved card the daily job hasn't held yet is held now, so the vendor
  // isn't kept waiting for it.
  if (booking.paymentStatus === "CARD_SAVED") {
    const held = await holdSavedCard(bookingId, now);
    if (!held) {
      throw new BookingError(
        "The client's card couldn't be charged. We've asked them to update it; the PIN will work once they have.",
        "INVALID_TRANSITION",
        402,
      );
    }
    Object.assign(booking, await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }));
  }

  // Money first, then the record: a booking must never say "released" for a
  // transfer that did not happen.
  let transferId = "";
  if (booking.paymentStatus === "AUTHORISED" && booking.paymentIntentId) {
    const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
    const gateway = paymentGateway();
    if (gateway.mode === "stripe" && (!provider.stripeAccountId || !provider.payoutsEnabled)) {
      throw new BookingError(
        "Link your payout account before releasing payment. The PIN will still work afterwards.",
        "INVALID_TRANSITION",
        409,
      );
    }
    try {
      ({ transferId } = await gateway.captureAndTransfer({
        bookingId,
        paymentIntentId: booking.paymentIntentId,
        destinationAccountId: provider.stripeAccountId || `sim_acct_${providerId}`,
        payoutMinor: booking.providerPayoutMinor,
      }));
    } catch (error) {
      if (error instanceof PaymentError) {
        throw new BookingError(`Payment could not be released: ${error.message}`, "INVALID_TRANSITION", 502);
      }
      throw error;
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "PAYMENT_RELEASED",
        paymentStatus: booking.paymentStatus === "AUTHORISED" ? "ESCROW_RELEASED" : booking.paymentStatus,
        transferId,
        escrowReleasedAt: now,
        disputeWindowClosesAt: disputeWindowClosesAt(now),
        // Single use: the code is spent the moment it matches.
        completionPin: "",
      },
    });
    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: "COMPLETED",
        toStatus: "PAYMENT_RELEASED",
        actor: "PROVIDER",
        note:
          booking.paymentStatus === "AUTHORISED"
            ? "PIN verified; escrow released to the vendor."
            : "PIN verified; no card hold was on file for this booking.",
      },
    });
    await tx.notification.create({
      data: {
        bookingId,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: "Appointment complete",
        body: "Payment has been released. You have 24 hours to raise a problem, and you can leave a review any time.",
      },
    });
    return updated;
  });
}

/**
 * File a service dispute. Allowed while the customer is still holding the PIN
 * (COMPLETED), and for 24 hours after release — never after.
 */
export async function fileDispute(
  bookingId: string,
  customerId: string,
  reason: string,
  now = new Date(),
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customerId) {
    throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  }

  const allowed =
    (booking.status === "COMPLETED" && booking.settlementStatus === "OPEN") ||
    ((booking.status === "PAYMENT_RELEASED" || booking.status === "REVIEWED") &&
      canDispute(booking, now));
  if (!allowed) {
    throw new BookingError(
      "The dispute window for this booking has closed.",
      "INVALID_TRANSITION",
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "DISPUTED",
        settlementStatus: "DISPUTED",
        disputeReason: reason.trim(),
        disputedAt: now,
        completionPin: "",
      },
    });
    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: booking.status,
        toStatus: "DISPUTED",
        actor: "CUSTOMER",
        note: reason.trim().slice(0, 1_000),
      },
    });
    await tx.notification.create({
      data: {
        bookingId,
        audience: "ADMIN",
        channel: "IN_APP",
        bookingType: booking.bookingType,
        title: "Service dispute filed",
        body: reason.trim().slice(0, 300),
      },
    });
    return updated;
  });
}

/**
 * Close every booking whose dispute window has passed. Idempotent; run from
 * the daily cron and lazily before settlement figures are shown.
 */
export async function closeExpiredDisputeWindows(now = new Date()) {
  const result = await prisma.booking.updateMany({
    where: {
      settlementStatus: "OPEN",
      disputeWindowClosesAt: { lte: now },
    },
    data: { settlementStatus: "CLOSED_UNCONTESTABLE" },
  });
  return result.count;
}
