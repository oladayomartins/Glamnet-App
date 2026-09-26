import type { Booking } from "@prisma/client";
import { prisma } from "./prisma";
import { paymentGateway, PaymentError } from "./payments";
import { BookingError, servedCustomer, settlementFields } from "./booking-service";
import { loadCandidates } from "./schedules";
import { deliverBookingNotice, deliverBroadcastEmails, formatAppointment } from "./notifications";
import { selectBroadcastTargets } from "@/lib/domain/matching";
import { addMinutes } from "@/lib/domain/availability";
import { BROADCAST_ACCEPTANCE_WINDOW_MINUTES } from "@/lib/domain/constants";
import { decideCommission, type BookingSource } from "@/lib/domain/settlement";
import { chargeMinorOf, holdIsDue, needsSavedCard, UNSECURED_CANCEL_HOURS } from "@/lib/domain/payment-rules";
import { formatMoney } from "@/lib/domain/pricing";

/**
 * Taking the customer's card, for every kind of booking.
 *
 * One path for the storefront checkout and the broadcast (/book, /search)
 * checkout alike:
 *
 *   start   → a hold now (PaymentIntent, manual capture), or — for a booking
 *             more than five days off — a saved card (SetupIntent), because
 *             Stripe drops an uncaptured hold after about seven days.
 *   secure  → once Stripe says the hold (or saved card) is in place: a
 *             storefront booking confirms, a broadcast booking goes out to
 *             vendors. Nothing is broadcast before the card is secured.
 *   daily   → saved cards due a hold get one off-session; a card that fails
 *             asks the customer for another; a booking still unpaid a day
 *             before is cancelled; abandoned checkouts and unanswered
 *             broadcasts let go of their holds.
 *
 * "Secured" is always confirmed with Stripe — by the browser calling back,
 * or by a webhook if the browser never does — never taken on a page's word.
 */

/** Payment states in which the card is in place (held now, or saved for later). */
export const SECURED = ["AUTHORISED", "CARD_SAVED"] as const;

/** Statuses in which a booking still needs its money in place. */
const LIVE_STATUSES = ["REQUESTED", "BROADCAST", "ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED", "PROVIDER_EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

export type PaymentStep =
  | { kind: "secured" }
  | { kind: "card"; mode: "payment" | "setup"; clientSecret: string };

/**
 * Ask Stripe for what this booking's checkout needs: a hold or a saved card.
 * Returns the client secret for Stripe Elements, or "secured" when nothing is
 * left for the customer to do (the simulated gateway).
 */
export async function startPayment(bookingId: string, now = new Date()): Promise<PaymentStep> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: { select: { name: true } } },
  });
  if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  if ((SECURED as readonly string[]).includes(booking.paymentStatus)) return { kind: "secured" };

  const gateway = paymentGateway();
  const attempt = booking.holdAttempts;
  const description = `GLAMNET — ${booking.provider?.name ?? "booking"}`;

  try {
    if (needsSavedCard(booking.appointmentStartAt, now)) {
      const stripeCustomerId = await gateway.ensureCustomer({
        customerId: booking.customerId,
        email: booking.customer.email,
        name: booking.customer.name,
        existingId: booking.customer.stripeCustomerId,
      });
      if (stripeCustomerId !== booking.customer.stripeCustomerId) {
        await prisma.customer.update({ where: { id: booking.customerId }, data: { stripeCustomerId } });
      }
      const saved = await gateway.saveCard({ bookingId, stripeCustomerId, attempt });
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          setupIntentId: saved.setupIntentId,
          paymentIntentId: "",
          paymentStatus: "PENDING_AUTHORISATION",
          holdAttempts: attempt + 1,
        },
      });
      if (saved.state === "SAVED") {
        await securePayment(bookingId, { paymentStatus: "CARD_SAVED", paymentMethodId: saved.paymentMethodId }, now);
        return { kind: "secured" };
      }
      return { kind: "card", mode: "setup", clientSecret: saved.clientSecret ?? "" };
    }

    const hold = await gateway.authorise({
      bookingId,
      amountMinor: chargeMinorOf(booking),
      customerEmail: booking.customer.email,
      description,
      attempt,
    });
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentIntentId: hold.paymentIntentId,
        setupIntentId: "",
        paymentStatus: "PENDING_AUTHORISATION",
        holdAttempts: attempt + 1,
      },
    });
    if (hold.state === "AUTHORISED") {
      await securePayment(bookingId, { paymentStatus: "AUTHORISED" }, now);
      return { kind: "secured" };
    }
    return { kind: "card", mode: "payment", clientSecret: hold.clientSecret ?? "" };
  } catch (error) {
    if (error instanceof PaymentError) {
      throw new BookingError(`We couldn't start the card payment: ${error.message}`, "INVALID_TRANSITION", 502);
    }
    throw error;
  }
}

/**
 * The customer's browser says Stripe has the card. Check with Stripe, and if
 * it's so, secure the booking. Safe to call twice (and alongside a webhook).
 */
export async function confirmPayment(bookingId: string, customerId: string, now = new Date()) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customerId) {
    throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  }
  if ((SECURED as readonly string[]).includes(booking.paymentStatus)) return booking;
  if (booking.paymentStatus !== "PENDING_AUTHORISATION" && booking.paymentStatus !== "AUTHORISATION_FAILED") {
    throw new BookingError("This booking has no card payment to confirm.", "INVALID_TRANSITION", 409);
  }

  const gateway = paymentGateway();
  if (booking.paymentIntentId) {
    const state = await gateway.authorisationState(booking.paymentIntentId);
    if (state !== "AUTHORISED") {
      throw new BookingError("Your card has not been authorised yet. Please try again.", "INVALID_TRANSITION", 402);
    }
    return securePayment(bookingId, { paymentStatus: "AUTHORISED" }, now);
  }
  if (booking.setupIntentId) {
    const saved = await gateway.savedCardState(booking.setupIntentId);
    if (saved.state !== "SAVED") {
      throw new BookingError("Your card has not been saved yet. Please try again.", "INVALID_TRANSITION", 402);
    }
    return securePayment(bookingId, { paymentStatus: "CARD_SAVED", paymentMethodId: saved.paymentMethodId }, now);
  }
  throw new BookingError("This booking has no card payment to confirm.", "INVALID_TRANSITION", 409);
}

/**
 * The customer puts in a card again: after a hold failed or lapsed, or to
 * finish a checkout they left. Starts a fresh hold (or saved card).
 */
export async function retryPayment(bookingId: string, customerId: string, now = new Date()) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customerId) {
    throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  }
  if (!LIVE_STATUSES.includes(booking.status) || booking.status === "COMPLETED") {
    throw new BookingError("This booking can no longer take a card.", "INVALID_TRANSITION", 409);
  }
  if (booking.paymentStatus !== "AUTHORISATION_FAILED" && booking.paymentStatus !== "PENDING_AUTHORISATION") {
    throw new BookingError("Your card is already in place for this booking.", "INVALID_TRANSITION", 409);
  }
  return startPayment(bookingId, now);
}

/**
 * Record that the card is in place, and move the booking on: a storefront
 * booking confirms; a broadcast booking goes out to vendors; a booking that
 * was waiting for a replacement card simply carries on.
 *
 * Guarded on the payment status, so a webhook and the browser arriving at the
 * same moment secure it once.
 */
export async function securePayment(
  bookingId: string,
  update: { paymentStatus: "AUTHORISED" | "CARD_SAVED"; paymentMethodId?: string; paymentIntentId?: string },
  now = new Date(),
): Promise<Booking> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: bookingId, paymentStatus: { in: ["PENDING_AUTHORISATION", "AUTHORISATION_FAILED", "CARD_SAVED"] } },
      data: {
        paymentStatus: update.paymentStatus,
        paymentFailureReason: "",
        ...(update.paymentMethodId ? { paymentMethodId: update.paymentMethodId } : {}),
        ...(update.paymentIntentId ? { paymentIntentId: update.paymentIntentId } : {}),
        ...(update.paymentStatus === "AUTHORISED" ? { holdAuthorisedAt: now } : {}),
      },
    });
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (claimed.count === 0) return { booking, broadcast: false };

    // A storefront booking holds the vendor's slot at ACCEPTED until its card
    // is in place, and confirms here.
    if (booking.status === "ACCEPTED" && booking.source !== "BROADCAST") {
      await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
      await tx.bookingStatusEvent.create({
        data: {
          bookingId,
          fromStatus: "ACCEPTED",
          toStatus: "CONFIRMED",
          actor: "SYSTEM",
          note: update.paymentStatus === "CARD_SAVED" ? "Card saved; it will be held nearer the date." : "Card hold in place.",
        },
      });
      await tx.notification.createMany({
        data: [
          {
            bookingId,
            audience: "CUSTOMER",
            channel: "PUSH",
            bookingType: booking.bookingType,
            title: "Booking confirmed",
            body:
              update.paymentStatus === "CARD_SAVED"
                ? "Your card is saved. We'll hold the amount a few days before, and nothing is taken until your appointment is finished."
                : "Your card hold is in place. Nothing is taken until your appointment is finished.",
          },
          {
            bookingId,
            audience: "PROVIDER",
            providerId: booking.providerId,
            channel: "PUSH",
            bookingType: booking.bookingType,
            title: "New booking from your storefront",
            body: "A client has booked you and their card is in place.",
          },
        ],
      });
      return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId } }), broadcast: false };
    }

    return { booking, broadcast: booking.status === "REQUESTED" };
  });

  if (result.broadcast) await dispatchBroadcast(bookingId, now);
  return result.booking;
}

/**
 * Send a paid-for request to the top eligible vendors. The vendor list is
 * worked out again now: calendars move between checkout and payment. If
 * nobody can come any more, the hold is let go and the customer told.
 */
export async function dispatchBroadcast(bookingId: string, now = new Date()) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: true, hub: true },
  });
  if (!booking || booking.status !== "REQUESTED") return;

  const candidates = await loadCandidates(booking.hub, booking.appointmentStartAt, booking.reservedUntilAt);
  const eligible = selectBroadcastTargets(candidates, {
    sector: booking.hub.sector,
    requiredServiceIds: booking.items.filter((item) => item.kind === "SERVICE").map((item) => item.serviceId),
    appointmentStartAt: booking.appointmentStartAt,
    serviceDurationMinutes: booking.serviceDurationMinutes,
  }).map((match) => match.providerId);

  if (eligible.length === 0) {
    await endUnpaidBooking(booking, "EXPIRED", "Nobody was free by the time the card was in place.", {
      title: "Nobody's free for that time now",
      body: "The slot went while you were paying. Your card hold has been released — please pick another time.",
    });
    return;
  }

  // Dual commission: each invited vendor is quoted what *they* would earn.
  const served = await servedCustomer(booking.customerId, eligible);
  const price = {
    totalMinor: booking.totalInvoicePriceMinor,
    subtotalMinor: booking.subtotalMinor,
    emergencySurchargeMinor: booking.emergencySurchargeMinor,
    otherSurchargesMinor: booking.otherSurchargesMinor,
    trustFeeMinor: booking.trustFeeMinor,
  };
  const expiresAt = addMinutes(now, BROADCAST_ACCEPTANCE_WINDOW_MINUTES);
  const isEmergency = booking.bookingType === "EMERGENCY";
  const thresholdHours = Math.round(booking.thresholdMinutesUsed / 60);

  const sent = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: bookingId, status: "REQUESTED" },
      data: { status: "BROADCAST" },
    });
    if (claimed.count === 0) return false;
    await tx.bookingBroadcast.createMany({
      data: eligible.map((providerId) => {
        const quoted = settlementFields(
          price,
          decideCommission({ source: "BROADCAST" as BookingSource, hasPriorBooking: served.has(providerId) }),
        );
        return {
          bookingId,
          providerId,
          expiresAt,
          earningsMinor: quoted.providerEarningsMinor,
          emergencyEarningsMinor: quoted.providerEmergencyEarningsMinor,
        };
      }),
    });
    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: "REQUESTED",
        toStatus: "BROADCAST",
        actor: "SYSTEM",
        note: `Card in place; broadcast to ${eligible.length} provider(s).`,
      },
    });
    // Spec §11: the EMERGENCY tag must appear consistently in every channel.
    await tx.notification.createMany({
      data: eligible.map((providerId) => ({
        bookingId,
        providerId,
        audience: "PROVIDER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: isEmergency ? "EMERGENCY BOOKING REQUEST" : "New booking request",
        body: isEmergency
          ? `A customer needs a beauty service within the next ${thresholdHours} hours.`
          : `New request in sector ${booking.sector}.`,
      })),
    });
    return true;
  });

  if (sent) {
    await deliverBroadcastEmails({
      bookingId,
      providerIds: eligible,
      isEmergency,
      serviceNames: booking.items.map((item) => item.name),
      appointmentStartAt: booking.appointmentStartAt,
      sector: booking.sector,
      providerEarningsMinor: booking.providerEarningsMinor,
    });
  }
}

/**
 * Close a booking that can't go ahead for want of payment (or of a vendor),
 * letting go of any hold. Guarded, so it runs once.
 */
async function endUnpaidBooking(
  booking: Booking,
  to: "EXPIRED" | "CANCELLED",
  note: string,
  tell: { title: string; body: string },
) {
  const ended = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: to, ...(to === "CANCELLED" ? { cancelledReason: note } : {}) },
    });
    if (claimed.count === 0) return false;
    await tx.bookingStatusEvent.create({
      data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, actor: "SYSTEM", note },
    });
    await tx.bookingBroadcast.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    await tx.notification.create({
      data: {
        bookingId: booking.id,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title: tell.title,
        body: tell.body,
      },
    });
    if (booking.providerId) {
      await tx.notification.create({
        data: {
          bookingId: booking.id,
          audience: "PROVIDER",
          providerId: booking.providerId,
          channel: "PUSH",
          bookingType: booking.bookingType,
          title: "Booking cancelled",
          body: "The client's card couldn't be secured, so this booking has been cancelled and your time freed.",
        },
      });
    }
    return true;
  });
  if (ended) await releaseHold(booking);
  return ended;
}

/** Let go of an uncaptured hold. Never throws: an unreleased hold lapses anyway. */
async function releaseHold(booking: Booking) {
  if (["ESCROW_RELEASED", "REFUNDED", "PARTIALLY_REFUNDED", "VOIDED"].includes(booking.paymentStatus)) return;
  if (booking.paymentIntentId && ["AUTHORISED", "PENDING_AUTHORISATION"].includes(booking.paymentStatus)) {
    try {
      await paymentGateway().void(booking.paymentIntentId);
    } catch (error) {
      console.error("[payments] could not release hold", booking.id, error);
    }
  }
  if (booking.paymentStatus !== "NOT_STARTED") {
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "VOIDED" } });
  }
}

/**
 * Hold a saved card now, without the customer present. Used by the daily job
 * for bookings coming up, and at release if that job hasn't reached it yet.
 * Returns whether the hold is in place.
 */
export async function holdSavedCard(bookingId: string, now = new Date()): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: { select: { name: true } } },
  });
  if (!booking) return false;
  if (booking.paymentStatus === "AUTHORISED") return true;
  if (booking.paymentStatus !== "CARD_SAVED" || !booking.paymentMethodId) return false;

  const attempt = booking.holdAttempts;
  const hold = await paymentGateway().authoriseSaved({
    bookingId,
    amountMinor: chargeMinorOf(booking),
    stripeCustomerId: booking.customer.stripeCustomerId,
    paymentMethodId: booking.paymentMethodId,
    description: `GLAMNET — ${booking.provider?.name ?? "booking"}`,
    attempt,
  });

  if (hold.state === "AUTHORISED") {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentIntentId: hold.paymentIntentId,
        paymentStatus: "AUTHORISED",
        holdAuthorisedAt: now,
        holdAttempts: attempt + 1,
        paymentFailureReason: "",
      },
    });
    await prisma.bookingStatusEvent.create({
      data: { bookingId, fromStatus: booking.status, toStatus: booking.status, actor: "SYSTEM", note: "Saved card held for the appointment." },
    });
    return true;
  }

  await markHoldFailed(
    { ...booking, paymentIntentId: hold.paymentIntentId || booking.paymentIntentId, holdAttempts: attempt + 1 },
    hold.state === "PENDING_AUTHORISATION"
      ? "Your bank wants you to approve this payment."
      : hold.failureReason || "Your card was declined.",
  );
  return false;
}

/**
 * The card can't be held (declined, needs the customer, or the hold lapsed).
 * Ask the customer for another card; the booking stays in place for now.
 */
export async function markHoldFailed(
  booking: Booking & { customer?: { name: string; email: string } | null },
  reason: string,
) {
  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: { in: ["CARD_SAVED", "AUTHORISED", "PENDING_AUTHORISATION"] } },
    data: {
      paymentStatus: "AUTHORISATION_FAILED",
      paymentFailureReason: reason.slice(0, 300),
      paymentIntentId: booking.paymentIntentId,
      holdAttempts: booking.holdAttempts,
    },
  });
  if (claimed.count === 0) return;

  await prisma.notification.create({
    data: {
      bookingId: booking.id,
      audience: "CUSTOMER",
      channel: "PUSH",
      bookingType: booking.bookingType,
      title: "Your card needs attention",
      body: "We couldn't hold the payment for your appointment. Open your booking to add a card, or it will be cancelled the day before.",
    },
  });
  const customer = booking.customer ?? (await prisma.customer.findUnique({ where: { id: booking.customerId } }));
  if (customer) {
    await deliverBookingNotice({
      to: customer.email,
      name: customer.name.split(/\s+/)[0] || customer.name,
      bookingId: booking.id,
      subject: "Action needed: your GLAMNET booking",
      heading: "Your card needs attention",
      lead: `We couldn't hold the payment for your appointment (${reason.replace(/[.\s]+$/, "")}). Add a card so your booking goes ahead — if we can't secure it, it will be cancelled the day before.`,
      facts: [
        ["Appointment", formatAppointment(booking.appointmentStartAt)],
        ["Amount", formatMoney(chargeMinorOf(booking))],
      ],
      cta: "Update my card",
    });
  }
}

/**
 * Stripe says a hold was cancelled. If it was ours to cancel we already know;
 * if it lapsed (Stripe's seven days) on a booking still going ahead, ask the
 * customer for their card again.
 */
export async function onHoldCancelled(paymentIntentId: string) {
  const booking = await prisma.booking.findFirst({ where: { paymentIntentId } });
  if (!booking || booking.paymentStatus !== "AUTHORISED") return;
  if (!LIVE_STATUSES.includes(booking.status) || booking.status === "COMPLETED") return;
  await markHoldFailed(booking, "The hold on your card expired before the appointment.");
}

/**
 * The daily payment sweep. Each step is independent and idempotent, so a
 * missed or repeated run does no harm.
 */
export async function runPaymentSweep(now = new Date()) {
  const results = { held: 0, failed: 0, cancelled: 0, abandoned: 0, unanswered: 0 };

  // 1. Saved cards due their hold.
  const due = await prisma.booking.findMany({
    where: { paymentStatus: "CARD_SAVED", status: { in: LIVE_STATUSES } },
    select: { id: true, appointmentStartAt: true },
    take: 200,
  });
  for (const booking of due.filter((row) => holdIsDue(row.appointmentStartAt, now))) {
    try {
      if (await holdSavedCard(booking.id, now)) results.held += 1;
      else results.failed += 1;
    } catch (error) {
      results.failed += 1;
      console.error("[payments] saved-card hold failed", booking.id, error);
    }
  }

  // 2. Still no card in place a day before: cancel, freeing the vendor.
  const unsecured = await prisma.booking.findMany({
    where: {
      paymentStatus: { in: ["AUTHORISATION_FAILED"] },
      status: { in: ["BROADCAST", "ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED"] },
      appointmentStartAt: { lte: addMinutes(now, UNSECURED_CANCEL_HOURS * 60) },
    },
    include: { customer: true, provider: { select: { name: true, email: true } } },
    take: 200,
  });
  for (const booking of unsecured) {
    const ended = await endUnpaidBooking(booking, "CANCELLED", "Card could not be secured before the appointment.", {
      title: "Booking cancelled",
      body: "We couldn't secure a card for this appointment, so it has been cancelled. Nothing was charged.",
    });
    if (!ended) continue;
    results.cancelled += 1;
    const facts: Array<[string, string]> = [["Appointment", formatAppointment(booking.appointmentStartAt)]];
    await deliverBookingNotice({
      to: booking.customer.email,
      name: booking.customer.name.split(/\s+/)[0] || booking.customer.name,
      bookingId: booking.id,
      subject: "Your GLAMNET booking has been cancelled",
      heading: "Booking cancelled",
      lead: "We couldn't secure a card for this appointment, so it has been cancelled. Nothing was charged — you're welcome to book again.",
      facts,
      cta: "View booking",
    });
    if (booking.provider) {
      await deliverBookingNotice({
        to: booking.provider.email,
        name: booking.provider.name.split(/\s+/)[0] || booking.provider.name,
        bookingId: booking.id,
        path: "/provider",
        subject: "A GLAMNET booking has been cancelled",
        heading: "Booking cancelled",
        lead: "The client's card couldn't be secured, so this booking has been cancelled and your time is free again. Please don't travel to it.",
        facts,
        cta: "Open my dashboard",
      });
    }
  }

  // 3. Broadcast checkouts left before the card step: nothing was sent, but
  //    any half-made hold is let go.
  const abandoned = await prisma.booking.findMany({
    where: {
      status: "REQUESTED",
      paymentStatus: { in: ["NOT_STARTED", "PENDING_AUTHORISATION"] },
      bookingCreatedAt: { lt: addMinutes(now, -60) },
    },
    take: 200,
  });
  for (const booking of abandoned) {
    const ended = await endUnpaidBooking(booking, "EXPIRED", "Checkout not completed.", {
      title: "Booking not completed",
      body: "Your card wasn't added, so this request wasn't sent. Nothing was charged.",
    });
    if (ended) results.abandoned += 1;
  }

  results.unanswered = await expireUnansweredBroadcasts(now);
  return results;
}

/**
 * Broadcasts that no invited vendor can still accept: each one lapsed or
 * was declined. The customer's hold is released straight away rather than
 * left on their card for a week. Run on each poll of the searching screen,
 * by the daily sweep, and when a vendor declines.
 */
export async function expireUnansweredBroadcasts(now = new Date(), bookingId?: string) {
  const stale = await prisma.booking.findMany({
    where: {
      ...(bookingId ? { id: bookingId } : {}),
      status: "BROADCAST",
      providerId: null,
      broadcasts: {
        every: { OR: [{ expiresAt: { lt: now } }, { status: { not: "PENDING" } }] },
        some: {},
      },
    },
    take: 200,
  });
  let count = 0;
  for (const booking of stale) {
    const ended = await endUnpaidBooking(booking, "EXPIRED", "No vendor accepted in time.", {
      title: "Nobody could take this one",
      body: "No vendor accepted in time, so your card hold has been released. Try another time — nothing was charged.",
    });
    if (ended) count += 1;
  }
  return count;
}

/**
 * A vendor turns a broadcast down. The request leaves their inbox, and it
 * counts against their acceptance rate just as letting it lapse would. If
 * they were the last invited vendor who could still say yes, the search ends
 * now instead of making the customer wait out the timer.
 *
 * Declining twice is harmless; declining a request that has already been
 * taken, lapsed or ended is refused.
 */
export async function declineBroadcast(bookingId: string, providerId: string, now = new Date()) {
  const declined = await prisma.bookingBroadcast.updateMany({
    where: { bookingId, providerId, status: "PENDING", expiresAt: { gt: now } },
    data: { status: "DECLINED", respondedAt: now },
  });

  if (declined.count === 0) {
    const invite = await prisma.bookingBroadcast.findUnique({
      where: { bookingId_providerId: { bookingId, providerId } },
      select: { status: true },
    });
    if (!invite) {
      throw new BookingError("This request was not offered to you.", "NOT_INVITED", 403);
    }
    if (invite.status === "DECLINED") return;
    throw new BookingError("This request is no longer open.", "INVALID_TRANSITION", 409);
  }

  await expireUnansweredBroadcasts(now, bookingId);
}
