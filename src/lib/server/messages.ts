import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { deliverBookingNotice } from "./notifications";
import { messagingOpen, MESSAGE_BURST_LIMIT, MESSAGE_BURST_MINUTES, MESSAGE_EMAIL_QUIET_MINUTES } from "@/lib/domain/messaging";
import { addMinutes } from "@/lib/domain/availability";

/**
 * Messages between a client and the vendor on their booking.
 *
 * The thread lives on the booking, so only the two people on it (and the
 * admin team, read-only, for disputes) can see it. Each message also writes a
 * Notification for the other side, which the database client pushes to their
 * devices; an email follows only when the thread has been quiet, so a quick
 * back-and-forth is not a flood of mail.
 */

export type MessageViewer =
  | { role: "CUSTOMER"; customerId: string }
  | { role: "PROVIDER"; providerId: string }
  | { role: "ADMIN" };

const BOOKING_FIELDS = {
  id: true,
  status: true,
  paymentStatus: true,
  appointmentStartAt: true,
  bookingType: true,
  customerId: true,
  providerId: true,
  customer: { select: { name: true, email: true } },
  provider: { select: { name: true, email: true } },
} as const;

async function loadFor(bookingId: string, viewer: MessageViewer) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: BOOKING_FIELDS });
  const mayView =
    booking &&
    (viewer.role === "ADMIN" ||
      (viewer.role === "CUSTOMER" && booking.customerId === viewer.customerId) ||
      (viewer.role === "PROVIDER" && booking.providerId !== null && booking.providerId === viewer.providerId));
  // Not found rather than forbidden: an outsider learns nothing about the id.
  if (!booking || !mayView) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  return booking;
}

export async function listMessages(bookingId: string, viewer: MessageViewer, now = new Date()) {
  const booking = await loadFor(bookingId, viewer);
  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, senderRole: true, body: true, createdAt: true },
  });
  return { open: viewer.role !== "ADMIN" && messagingOpen(booking, now), messages };
}

export async function postMessage(bookingId: string, viewer: MessageViewer, text: string, now = new Date()) {
  if (viewer.role === "ADMIN") {
    throw new BookingError("Support reads booking messages but does not post in them.", "INVALID_TRANSITION", 403);
  }
  const booking = await loadFor(bookingId, viewer);
  if (!messagingOpen(booking, now)) {
    throw new BookingError("Messages are closed for this booking.", "INVALID_TRANSITION", 409);
  }
  const body = text.trim();
  if (!body) throw new BookingError("Write a message first.", "INVALID_TRANSITION", 422);

  const senderRole = viewer.role;
  const recent = await prisma.bookingMessage.findMany({
    where: { bookingId, senderRole, createdAt: { gte: addMinutes(now, -MESSAGE_BURST_MINUTES) } },
    select: { createdAt: true },
  });
  if (recent.length >= MESSAGE_BURST_LIMIT) {
    throw new BookingError("That's a lot of messages in a short time. Please wait a few minutes.", "INVALID_TRANSITION", 429);
  }

  const message = await prisma.bookingMessage.create({
    data: { bookingId, senderRole, body },
    select: { id: true, senderRole: true, body: true, createdAt: true },
  });

  const fromCustomer = senderRole === "CUSTOMER";
  const senderName = fromCustomer
    ? (booking.customer.name.split(/\s+/)[0] || "Your client")
    : (booking.provider?.name ?? "Your vendor");
  const preview = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  const title = `New message from ${senderName}`;

  // Was the other side already told about a message in the last little while?
  const lastNotice = await prisma.notification.findFirst({
    where: {
      bookingId,
      audience: fromCustomer ? "PROVIDER" : "CUSTOMER",
      title: { startsWith: "New message" },
      createdAt: { gte: addMinutes(now, -MESSAGE_EMAIL_QUIET_MINUTES) },
    },
    select: { id: true },
  });

  await prisma.notification.create({
    data: {
      bookingId,
      audience: fromCustomer ? "PROVIDER" : "CUSTOMER",
      providerId: fromCustomer ? booking.providerId : null,
      channel: "PUSH",
      bookingType: booking.bookingType,
      title,
      body: preview,
    },
  });

  if (!lastNotice) {
    const to = fromCustomer ? booking.provider?.email : booking.customer.email;
    const name = fromCustomer ? (booking.provider?.name ?? "") : booking.customer.name;
    if (to) {
      await deliverBookingNotice({
        to,
        name: name.split(/\s+/)[0] || name,
        bookingId,
        subject: title,
        heading: title,
        lead: `“${preview}”`,
        cta: "Reply",
      });
    }
  }

  return message;
}
