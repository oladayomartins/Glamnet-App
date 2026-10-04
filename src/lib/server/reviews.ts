import { prisma } from "./prisma";
import { BookingError } from "./booking-service";

/** Longest reply a vendor can post under a review. */
export const REVIEW_REPLY_MAX_LENGTH = 1_000;

/**
 * A vendor's public reply to a review on one of their bookings. Posting again
 * edits the reply; an empty reply removes it. The client is told the first
 * time, not on every edit.
 */
export async function replyToReview(bookingId: string, providerId: string, text: string, now = new Date()) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, providerId: true, rating: true, reviewReply: true, bookingType: true, provider: { select: { name: true } } },
  });
  if (!booking || booking.providerId !== providerId) {
    throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  }
  if (booking.rating === null) {
    throw new BookingError("There's no review on this booking to reply to.", "INVALID_TRANSITION", 409);
  }
  const reply = text.trim();
  if (reply.length > REVIEW_REPLY_MAX_LENGTH) {
    throw new BookingError(`Keep your reply under ${REVIEW_REPLY_MAX_LENGTH} characters.`, "INVALID_TRANSITION", 422);
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { reviewReply: reply, reviewRepliedAt: reply ? now : null },
    select: { id: true, reviewReply: true, reviewRepliedAt: true },
  });

  if (reply && !booking.reviewReply) {
    await prisma.notification.create({
      data: {
        bookingId: booking.id,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: `${booking.provider?.name ?? "Your vendor"} replied to your review`,
        body: reply.length > 140 ? `${reply.slice(0, 137)}…` : reply,
      },
    });
  }
  return updated;
}

/** Every review on a vendor's bookings, newest first, for their reviews page. */
export async function listVendorReviews(providerId: string) {
  const rows = await prisma.booking.findMany({
    where: { providerId, rating: { not: null } },
    orderBy: { appointmentStartAt: "desc" },
    take: 200,
    select: {
      id: true,
      rating: true,
      reviewNote: true,
      reviewReply: true,
      reviewRepliedAt: true,
      appointmentStartAt: true,
      customer: { select: { name: true } },
      items: { select: { name: true, kind: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating ?? 0,
    note: row.reviewNote,
    reply: row.reviewReply,
    repliedAt: row.reviewRepliedAt?.toISOString() ?? null,
    at: row.appointmentStartAt.toISOString(),
    // First name only, as on the storefront.
    client: row.customer.name.split(/\s+/)[0] || "A client",
    services: row.items.filter((item) => item.kind !== "ADDON").map((item) => item.name),
  }));
}
