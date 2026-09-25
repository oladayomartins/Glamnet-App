import type { Booking } from "@prisma/client";
import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { paymentGateway, PaymentError } from "./payments";
import { voidPaymentForBooking } from "./escrow";
import { deliverBookingNotice, formatAppointment } from "./notifications";
import {
  noShowAllowedFrom,
  noShowFeeMinor,
  PROVIDER_CANCELLABLE,
  quoteCustomerCancellation,
  travelInNoShowFeeMinor,
  vendorShareOfFeeMinor,
  freeCancellationEndsAt,
  FREE_CANCELLATION_HOURS,
} from "@/lib/domain/cancellation";
import { disputeWindowClosesAt } from "@/lib/domain/completion";
import { formatMoney } from "@/lib/domain/pricing";
import { addMinutes } from "@/lib/domain/availability";

/**
 * Cancellations and no-shows (policy in domain/cancellation.ts).
 *
 * The booking is claimed first — moved to CANCELLED or NO_SHOW, guarded on
 * the status it was quoted in — so a vendor tapping "On my way" at the same
 * moment can't leave the fee and the status disagreeing. Money moves after
 * the claim, and the fee is recorded only once Stripe has taken it: a fee
 * that couldn't be collected is simply not charged, and the hold released.
 *
 * A fee is released to the vendor like a payment, so the customer can
 * dispute it for 24 hours, the same as any completed booking.
 */

export type Canceller =
  | { role: "CUSTOMER"; customerId: string }
  | { role: "PROVIDER"; providerId: string }
  | { role: "ADMIN" };

/** Statuses an admin may cancel from: anything not yet under way. */
const ADMIN_CANCELLABLE = ["REQUESTED", "BROADCAST", ...PROVIDER_CANCELLABLE];

type FullBooking = Booking & {
  customer: { name: string; email: string; stripeCustomerId: string };
  provider: { name: string; email: string; stripeAccountId: string; payoutsEnabled: boolean } | null;
};

async function load(bookingId: string): Promise<FullBooking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, email: true, stripeCustomerId: true } },
      provider: { select: { name: true, email: true, stripeAccountId: true, payoutsEnabled: true } },
    },
  });
  if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  return booking;
}

const firstName = (name: string) => name.split(/\s+/)[0] || name;

/** The customer's cancellation terms for this booking, as the page shows them. */
export async function cancellationQuote(bookingId: string, customerId: string, now = new Date()) {
  const booking = await load(bookingId);
  if (booking.customerId !== customerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  return quoteCustomerCancellation(booking, now);
}

/**
 * Cancel a booking.
 *
 * `acceptedFeeMinor` is the fee the customer was shown when they confirmed.
 * If the fee has gone up since (the page sat open past the 24-hour mark),
 * nothing happens and they're asked to confirm again.
 */
export async function cancelBooking(
  bookingId: string,
  by: Canceller,
  input: { reason?: string; acceptedFeeMinor?: number },
  now = new Date(),
) {
  const booking = await load(bookingId);
  const reason = (input.reason ?? "").trim().slice(0, 500);

  let feeMinor = 0;
  let travelInFee = 0;
  if (by.role === "CUSTOMER") {
    if (booking.customerId !== by.customerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
    const quote = quoteCustomerCancellation(booking, now);
    if (!quote.allowed) throw new BookingError(quote.explanation, "INVALID_TRANSITION", 409);
    feeMinor = quote.feeMinor;
    travelInFee = quote.kind === "MISSED" ? travelInNoShowFeeMinor(booking) : 0;
    if (input.acceptedFeeMinor !== undefined && feeMinor > input.acceptedFeeMinor) {
      throw new BookingError(
        `Cancelling now costs ${formatMoney(feeMinor)}. Please check and confirm again.`,
        "INVALID_TRANSITION",
        409,
      );
    }
  } else if (by.role === "PROVIDER") {
    if (booking.providerId !== by.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
    if (!PROVIDER_CANCELLABLE.includes(booking.status)) {
      throw new BookingError("This job can't be cancelled now. Contact us if something's wrong.", "INVALID_TRANSITION", 409);
    }
    if (reason.length < 5) {
      throw new BookingError("Tell the client briefly why you're cancelling.", "INVALID_TRANSITION", 422);
    }
  } else if (!ADMIN_CANCELLABLE.includes(booking.status)) {
    throw new BookingError(`Cannot cancel a booking that is ${booking.status}.`, "INVALID_TRANSITION", 409);
  }

  const note =
    by.role === "CUSTOMER"
      ? `Cancelled by the customer${feeMinor > 0 ? `; late-cancellation fee ${formatMoney(feeMinor)}` : ""}.${reason ? ` ${reason}` : ""}`
      : by.role === "PROVIDER"
        ? `Cancelled by the vendor: ${reason}`
        : `Cancelled by GLAMNET.${reason ? ` ${reason}` : ""}`;

  await claim(booking, "CANCELLED", by.role, note, now);
  const fee = feeMinor > 0 ? await collectFee(booking, feeMinor, travelInFee, now) : null;
  if (!fee?.collected) await voidPaymentForBooking(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }));
  const charged = fee?.collected ? fee.feeMinor : 0;

  await tellEveryone(booking, by.role, { charged, payout: fee?.collected ? fee.payoutMinor : 0, reason, fee, now });
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

/** The vendor marks the client as not having turned up. */
export async function markNoShow(bookingId: string, providerId: string, now = new Date()) {
  const booking = await load(bookingId);
  if (booking.providerId !== providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

  const arrived = await prisma.bookingStatusEvent.findFirst({
    where: { bookingId, toStatus: "ARRIVED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const from = noShowAllowedFrom(booking, booking.serviceLocation === "VENDOR_PREMISES" ? null : arrived?.createdAt ?? null);
  if (!from) {
    throw new BookingError(
      booking.serviceLocation === "VENDOR_PREMISES"
        ? "A no-show can only be marked while you're waiting for the client."
        : "Mark yourself as arrived first — a no-show can only be marked from the door.",
      "INVALID_TRANSITION",
      409,
    );
  }
  if (now < from) {
    throw new BookingError(
      `Please give the client until ${formatAppointment(from).split(", ").pop()} before marking a no-show.`,
      "INVALID_TRANSITION",
      409,
    );
  }

  const feeMinor = noShowFeeMinor(booking);
  await claim(booking, "NO_SHOW", "PROVIDER", `Client marked as a no-show; fee ${formatMoney(feeMinor)}.`, now);
  const fee = feeMinor > 0 ? await collectFee(booking, feeMinor, travelInNoShowFeeMinor(booking), now) : null;
  if (!fee?.collected) await voidPaymentForBooking(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }));

  const charged = fee?.collected ? fee.feeMinor : 0;
  const when = formatAppointment(booking.appointmentStartAt);
  await prisma.notification.create({
    data: {
      bookingId,
      audience: "CUSTOMER",
      channel: "PUSH",
      bookingType: booking.bookingType,
      title: "Missed appointment",
      body:
        charged > 0
          ? `${booking.provider?.name ?? "Your vendor"} marked you as not there. ${formatMoney(charged)} was charged. If you were there, tell us within 24 hours.`
          : `${booking.provider?.name ?? "Your vendor"} marked you as not there. If you were there, contact us.`,
    },
  });
  await deliverBookingNotice({
    to: booking.customer.email,
    name: firstName(booking.customer.name),
    bookingId,
    subject: "You missed your GLAMNET appointment",
    heading: "Missed appointment",
    lead:
      charged > 0
        ? `${booking.provider?.name ?? "Your vendor"} waited but couldn't find you, so under our cancellation policy the missed appointment has been charged. If you were there, open your booking and tell us within 24 hours — we'll look into it.`
        : `${booking.provider?.name ?? "Your vendor"} waited but couldn't find you. Nothing was charged. If you were there, let us know.`,
    facts: [
      ["Appointment", when],
      ["Charged", formatMoney(charged)],
    ],
    cta: "View booking",
  });
  return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

/** Move the booking to its end state, once. */
async function claim(booking: Booking, to: "CANCELLED" | "NO_SHOW", actor: string, note: string, now: Date) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: {
        status: to,
        cancelledReason: note.slice(0, 1_000),
        cancelledBy: actor,
        cancelledAt: now,
        completionPin: "",
        ...(to === "NO_SHOW" ? { noShowAt: now } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new BookingError("This booking has just changed. Refresh and try again.", "CONTENDED", 409);
    }
    await tx.bookingStatusEvent.create({
      data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, actor, note: note.slice(0, 1_000) },
    });
    await tx.bookingBroadcast.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  });
}

type FeeResult =
  | { collected: true; feeMinor: number; payoutMinor: number; payoutHeld: boolean }
  | { collected: false; why: string };

/**
 * Take the fee from the card: capture just the fee from the hold (the rest
 * of the hold is released by the same capture), and pay the vendor their
 * share. A card only saved for later is charged the fee directly.
 */
async function collectFee(booking: FullBooking, feeMinor: number, travelInFee: number, now: Date): Promise<FeeResult> {
  const gateway = paymentGateway();
  let paymentIntentId = booking.paymentIntentId;
  let holdAttempts = booking.holdAttempts;

  try {
    if (booking.paymentStatus === "CARD_SAVED" && booking.paymentMethodId) {
      const hold = await gateway.authoriseSaved({
        bookingId: booking.id,
        amountMinor: feeMinor,
        stripeCustomerId: booking.customer.stripeCustomerId,
        paymentMethodId: booking.paymentMethodId,
        description: `GLAMNET — cancellation fee, ${booking.provider?.name ?? "booking"}`,
        attempt: holdAttempts,
      });
      holdAttempts += 1;
      if (hold.state !== "AUTHORISED") {
        if (hold.paymentIntentId) await gateway.void(hold.paymentIntentId).catch(() => undefined);
        return await noFee(booking, holdAttempts, `the saved card was declined (${hold.failureReason || "no reason given"})`);
      }
      paymentIntentId = hold.paymentIntentId;
    } else if (booking.paymentStatus !== "AUTHORISED" || !paymentIntentId) {
      return { collected: false, why: "no card was held" };
    }

    const vendorShare = vendorShareOfFeeMinor({
      feeMinor,
      travelInFeeMinor: travelInFee,
      commissionBps: booking.commissionBps,
      firstDiscoveryBooking: booking.firstDiscoveryBooking,
    });
    // A vendor who hasn't finished payout set-up still earns their share; it
    // is kept back and paid by the team once they have.
    const payoutHeld = gateway.mode === "stripe" && (!booking.provider?.stripeAccountId || !booking.provider.payoutsEnabled);
    const { transferId } = await gateway.captureAndTransfer({
      bookingId: booking.id,
      paymentIntentId,
      destinationAccountId: booking.provider?.stripeAccountId || `sim_acct_${booking.providerId}`,
      payoutMinor: payoutHeld ? 0 : vendorShare,
      captureMinor: feeMinor,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentIntentId,
        holdAttempts,
        transferId,
        paymentStatus: "ESCROW_RELEASED",
        cancellationFeeMinor: feeMinor,
        cancellationFeePayoutMinor: vendorShare,
        escrowReleasedAt: now,
        disputeWindowClosesAt: disputeWindowClosesAt(now),
        settlementStatus: "OPEN",
      },
    });
    if (payoutHeld) {
      await prisma.notification.create({
        data: {
          bookingId: booking.id,
          audience: "ADMIN",
          channel: "IN_APP",
          bookingType: booking.bookingType,
          title: "Cancellation fee payout held",
          body: `${formatMoney(vendorShare)} is owed to ${booking.provider?.name ?? "the vendor"}, who hasn't finished payout set-up. Pay it once they have.`,
        },
      });
    }
    return { collected: true, feeMinor, payoutMinor: vendorShare, payoutHeld };
  } catch (error) {
    if (!(error instanceof PaymentError)) throw error;
    console.error("[cancellations] fee not collected", booking.id, error.message);
    if (paymentIntentId && paymentIntentId !== booking.paymentIntentId) {
      await gateway.void(paymentIntentId).catch(() => undefined);
    }
    return await noFee(booking, holdAttempts, `Stripe refused: ${error.message}`);
  }
}

/** Record that a fee was due but couldn't be taken, for the team to see. */
async function noFee(booking: Booking, holdAttempts: number, why: string): Promise<FeeResult> {
  await prisma.booking.update({ where: { id: booking.id }, data: { holdAttempts } });
  await prisma.bookingStatusEvent.create({
    data: {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: booking.status,
      actor: "SYSTEM",
      note: `Fee not collected: ${why}.`.slice(0, 1_000),
    },
  });
  return { collected: false, why };
}

/** Push and email both sides about a cancellation. */
async function tellEveryone(
  booking: FullBooking,
  by: Canceller["role"],
  facts: { charged: number; payout: number; reason: string; fee: FeeResult | null; now: Date },
) {
  const when = formatAppointment(booking.appointmentStartAt);
  const provider = booking.provider;
  const notifications: Array<{ audience: string; providerId?: string; title: string; body: string }> = [];

  if (by === "CUSTOMER") {
    notifications.push({
      audience: "CUSTOMER",
      title: "Booking cancelled",
      body: facts.charged > 0 ? `Your booking is cancelled. A late-cancellation fee of ${formatMoney(facts.charged)} was charged.` : "Your booking is cancelled and nothing was charged.",
    });
    if (provider && booking.providerId) {
      notifications.push({
        audience: "PROVIDER",
        providerId: booking.providerId,
        title: "A client cancelled",
        body:
          facts.payout > 0
            ? `Your ${when} booking was cancelled late. You'll receive ${formatMoney(facts.payout)} for it.`
            : `Your ${when} booking was cancelled, and your time is free again.`,
      });
    }
  } else {
    notifications.push({
      audience: "CUSTOMER",
      title: by === "PROVIDER" ? "Your vendor cancelled" : "Booking cancelled",
      body: `Your ${when} booking has been cancelled${by === "PROVIDER" ? " by your vendor" : ""}. Nothing was charged and the hold on your card is released.`,
    });
    if (by === "ADMIN" && provider && booking.providerId) {
      notifications.push({
        audience: "PROVIDER",
        providerId: booking.providerId,
        title: "Booking cancelled",
        body: `The GLAMNET team cancelled your ${when} booking. Please don't travel to it.`,
      });
    }
    // A vendor dropping a client inside a day is worth a look.
    if (by === "PROVIDER" && freeCancellationEndsAt(booking.appointmentStartAt) <= facts.now) {
      notifications.push({
        audience: "ADMIN",
        title: `Vendor cancelled within ${FREE_CANCELLATION_HOURS} hours`,
        body: `${provider?.name ?? "A vendor"} cancelled the ${when} booking: ${facts.reason}`.slice(0, 300),
      });
    }
  }

  await prisma.notification.createMany({
    data: notifications.map((row) => ({
      bookingId: booking.id,
      audience: row.audience,
      providerId: row.providerId,
      channel: row.audience === "ADMIN" ? "IN_APP" : "PUSH",
      bookingType: booking.bookingType,
      title: row.title,
      body: row.body,
    })),
  });

  // Emails: to whoever didn't cancel, and a receipt to a customer who did.
  if (by === "CUSTOMER") {
    await deliverBookingNotice({
      to: booking.customer.email,
      name: firstName(booking.customer.name),
      bookingId: booking.id,
      subject: "Your GLAMNET booking is cancelled",
      heading: "Booking cancelled",
      lead:
        facts.charged > 0
          ? `Your booking is cancelled. As it was less than ${FREE_CANCELLATION_HOURS} hours before the appointment, a fee of ${formatMoney(facts.charged)} was taken and the rest of the hold on your card released.`
          : "Your booking is cancelled and the hold on your card released in full. Nothing was charged.",
      facts: [["Appointment", when], ["Charged", formatMoney(facts.charged)]],
      cta: "View booking",
    });
  } else {
    await deliverBookingNotice({
      to: booking.customer.email,
      name: firstName(booking.customer.name),
      bookingId: booking.id,
      subject: "Your GLAMNET booking has been cancelled",
      heading: "Booking cancelled",
      lead:
        by === "PROVIDER"
          ? `Sorry — ${provider?.name ?? "your vendor"} has had to cancel. Nothing was charged and the hold on your card is released. You're welcome to book someone else.`
          : "The GLAMNET team has cancelled this booking. Nothing was charged and the hold on your card is released.",
      facts: [["Appointment", when], ...(by === "PROVIDER" && facts.reason ? [["Reason", facts.reason] as [string, string]] : [])],
      cta: "View booking",
    });
  }
  if (provider && by !== "PROVIDER") {
    await deliverBookingNotice({
      to: provider.email,
      name: firstName(provider.name),
      bookingId: booking.id,
      path: `/bookings/${booking.id}`,
      subject: "A GLAMNET booking has been cancelled",
      heading: "Booking cancelled",
      lead:
        facts.payout > 0
          ? `The client cancelled less than ${FREE_CANCELLATION_HOURS} hours before. Under the cancellation policy you'll receive ${formatMoney(facts.payout)}${facts.fee?.collected && facts.fee.payoutHeld ? " once your payout set-up is finished" : ""}. Please don't travel to it.`
          : "This booking has been cancelled and your time is free again. Please don't travel to it.",
      facts: [["Appointment", when]],
      cta: "View booking",
    });
  }
}

/**
 * The day-before reminder: free cancellation is about to end. Sent once per
 * booking by the daily job, to appointments 24–48 hours away — so every
 * booking is caught by exactly one run, before its free window closes.
 */
export async function sendCancellationReminders(now = new Date()) {
  const due = await prisma.booking.findMany({
    where: {
      status: { in: ["ACCEPTED", "CONFIRMED"] },
      reminderSentAt: null,
      appointmentStartAt: {
        gte: addMinutes(now, FREE_CANCELLATION_HOURS * 60),
        lt: addMinutes(now, FREE_CANCELLATION_HOURS * 2 * 60),
      },
    },
    include: { customer: { select: { name: true, email: true } }, provider: { select: { name: true } } },
    take: 500,
  });
  let sent = 0;
  for (const booking of due) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;
    const deadline = formatAppointment(freeCancellationEndsAt(booking.appointmentStartAt));
    await prisma.notification.create({
      data: {
        bookingId: booking.id,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: "Your appointment is coming up",
        body: `${booking.provider?.name ?? "Your vendor"} is booked for ${formatAppointment(booking.appointmentStartAt)}. Free cancellation ends ${deadline}.`,
      },
    });
    await deliverBookingNotice({
      to: booking.customer.email,
      name: firstName(booking.customer.name),
      bookingId: booking.id,
      subject: "Your GLAMNET appointment is coming up",
      heading: "See you soon",
      lead: `Just a reminder of your appointment with ${booking.provider?.name ?? "your vendor"}. If your plans have changed, you can cancel for free until ${deadline} — after that, cancelling costs half the service price and a missed appointment is charged in full.`,
      facts: [
        ["Appointment", formatAppointment(booking.appointmentStartAt)],
        ["Free cancellation until", deadline],
      ],
      cta: "View or cancel booking",
    });
    sent += 1;
  }
  return sent;
}
