/**
 * When the client and vendor on a booking can message each other. Pure, so
 * the page and the API agree and it can be tested without a database.
 */

/** Messages stay open this long after the appointment, for follow-ups. */
export const MESSAGES_OPEN_DAYS_AFTER = 7;

/** At most this many messages from one side within the window below. */
export const MESSAGE_BURST_LIMIT = 20;
export const MESSAGE_BURST_MINUTES = 10;

/** An email follows a message only if the thread was quiet this long. */
export const MESSAGE_EMAIL_QUIET_MINUTES = 30;

export const MESSAGE_MAX_LENGTH = 1_000;

/** Payment states in which a checkout was never finished. */
const UNPAID = ["NOT_STARTED", "PENDING_AUTHORISATION"];

export function messagingOpen(
  booking: {
    status: string;
    paymentStatus: string;
    providerId: string | null;
    appointmentStartAt: Date;
  },
  now = new Date(),
): boolean {
  // Nobody to talk to until a vendor has the job.
  if (!booking.providerId) return false;
  // An expired request, or a checkout abandoned before the card went in, is
  // not a booking yet — and must not become a way to reach a vendor off it.
  if (booking.status === "EXPIRED") return false;
  if (UNPAID.includes(booking.paymentStatus) && ["REQUESTED", "BROADCAST", "ACCEPTED"].includes(booking.status)) {
    return false;
  }
  const closesAt = booking.appointmentStartAt.getTime() + MESSAGES_OPEN_DAYS_AFTER * 24 * 60 * 60 * 1_000;
  return now.getTime() < closesAt;
}
