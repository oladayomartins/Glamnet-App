import { z } from "zod";
import { prisma } from "../prisma";
import { paymentGateway, PaymentError } from "../payments";
import { deliverBookingNotice, formatAppointment } from "../notifications";
import { disputedAmountsOf } from "@/lib/domain/payment-rules";
import { formatMoney } from "@/lib/domain/pricing";
import { AdminError, audit } from "./core";

/**
 * What an admin can do to a booking outside a dispute: give money back, and
 * move it to another vendor. Cancelling goes through cancelBooking() in
 * cancellations.ts, which already handles an admin cancelling.
 */

/** Statuses a booking can be moved to another vendor from: booked, not begun. */
export const REASSIGNABLE = ["ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED"];
/** Statuses that hold a vendor's time. */
const BUSY = ["ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED", "PROVIDER_EN_ROUTE", "ARRIVED", "IN_PROGRESS"];

const firstName = (name: string) => name.split(/\s+/)[0] || name;

// --- Refunds --------------------------------------------------------------------

export const refundInput = z.object({
  refundMinor: z.number().int().min(1).max(10_000_000),
  clawbackMinor: z.number().int().min(0).max(10_000_000).default(0),
  note: z.string().trim().min(5, "Say briefly why — the customer is told.").max(1_000),
});

/** What can be refunded on a booking right now, and why not if nothing. */
export function refundability(booking: {
  paymentStatus: string;
  settlementStatus: string;
  refundedMinor: number;
  totalInvoicePriceMinor: number;
  tipMinor: number;
  discountMinor: number;
  providerPayoutMinor: number;
  cancellationFeeMinor: number;
  cancellationFeePayoutMinor: number;
  transferId: string;
}): { ok: true; chargeMinor: number; payoutMinor: number; canRecover: boolean } | { ok: false; reason: string } {
  if (booking.settlementStatus === "DISPUTED") return { ok: false, reason: "Under dispute — rule on the dispute instead." };
  if (booking.refundedMinor > 0) return { ok: false, reason: `Already refunded ${formatMoney(booking.refundedMinor)}.` };
  if (booking.paymentStatus === "AUTHORISED" || booking.paymentStatus === "CARD_SAVED") {
    return { ok: false, reason: "Nothing has been taken yet — cancel the booking to release the hold instead." };
  }
  if (booking.paymentStatus !== "ESCROW_RELEASED") return { ok: false, reason: "No card payment to refund." };
  const { chargeMinor, payoutMinor } = disputedAmountsOf(booking);
  if (chargeMinor <= 0) return { ok: false, reason: "Nothing was charged." };
  return { ok: true, chargeMinor, payoutMinor, canRecover: Boolean(booking.transferId) && payoutMinor > 0 };
}

/**
 * A goodwill or correction refund on a booking that has been paid for.
 *
 * Optionally recovers part of it from the vendor by reversing their
 * transfer; whatever isn't recovered GLAMNET absorbs. One refund per
 * booking: Stripe's idempotency key is the booking, so a second would be
 * refused, and a booking that needs more goes through a dispute.
 */
export async function refundBooking(actorEmail: string, bookingId: string, raw: unknown) {
  const input = refundInput.parse(raw);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, email: true } },
      provider: { select: { name: true, email: true } },
    },
  });
  if (!booking) throw new AdminError("Booking not found.", 404, "NOT_FOUND");

  const terms = refundability(booking);
  if (!terms.ok) throw new AdminError(terms.reason);
  if (input.refundMinor > terms.chargeMinor) {
    throw new AdminError(`At most ${formatMoney(terms.chargeMinor)} was charged.`, 422);
  }
  if (input.clawbackMinor > 0 && !terms.canRecover) {
    throw new AdminError("There's no transfer to the vendor on record to recover from.", 422);
  }
  if (input.clawbackMinor > Math.min(input.refundMinor, terms.payoutMinor)) {
    throw new AdminError(
      `Recover at most ${formatMoney(Math.min(input.refundMinor, terms.payoutMinor))}: no more than the refund or the vendor's payout.`,
      422,
    );
  }

  const { chargeMinor } = terms;
  const paid = booking;

  // Claim the refund first so two admins can't both send one.
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, refundedMinor: 0, refundId: "" },
    data: { refundId: "pending" },
  });
  if (claimed.count === 0) throw new AdminError("Someone has just refunded this booking.");

  const gateway = paymentGateway();
  let refundId = "";
  let reversalId = "";
  try {
    ({ refundId } = await gateway.refund({ bookingId, paymentIntentId: booking.paymentIntentId, amountMinor: input.refundMinor }));
    if (input.clawbackMinor > 0) {
      ({ reversalId } = await gateway.reverseTransfer({
        bookingId,
        transferId: booking.transferId,
        amountMinor: input.clawbackMinor,
      }));
    }
  } catch (error) {
    if (!refundId) {
      // Nothing left the account: release the claim so it can be retried.
      await prisma.booking.update({ where: { id: bookingId }, data: { refundId: "" } });
    } else {
      // The refund went through but recovering it from the vendor didn't:
      // record the refund, which happened, and say what didn't.
      await record(0);
    }
    if (error instanceof PaymentError) {
      throw new AdminError(
        refundId
          ? `The refund went through, but recovering it from the vendor didn't (Stripe: ${error.message}). GLAMNET has covered it.`
          : `Stripe refused: ${error.message}`,
        502,
      );
    }
    throw error;
  }
  await record(input.clawbackMinor);

  async function record(recoveredMinor: number) {
    const full = input.refundMinor >= chargeMinor;
    const summary = `${formatMoney(input.refundMinor)} refunded${recoveredMinor > 0 ? `, ${formatMoney(recoveredMinor)} recovered from the vendor` : ""}`;
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          refundedMinor: input.refundMinor,
          clawbackMinor: recoveredMinor,
          refundId,
          transferReversalId: reversalId,
          paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });
      await tx.bookingStatusEvent.create({
        data: {
          bookingId,
          fromStatus: paid.status,
          toStatus: paid.status,
          actor: "ADMIN",
          note: `Refund: ${summary}. ${input.note}`.slice(0, 1_000),
        },
      });
      await tx.notification.createMany({
        data: [
          {
            bookingId,
            audience: "CUSTOMER",
            channel: "PUSH",
            bookingType: paid.bookingType,
            title: "A refund is on its way",
            body: `${formatMoney(input.refundMinor)} is coming back to your card.`,
          },
          ...(recoveredMinor > 0 && paid.providerId
            ? [
                {
                  bookingId,
                  audience: "PROVIDER",
                  providerId: paid.providerId,
                  channel: "PUSH",
                  bookingType: paid.bookingType,
                  title: "A payout was adjusted",
                  body: `${formatMoney(recoveredMinor)} was deducted from a payout after a refund to your client.`,
                },
              ]
            : []),
        ],
      });
    });
    await audit(actorEmail, "booking.refund", { type: "Booking", id: bookingId }, `${summary} — ${input.note}`);
    await deliverBookingNotice({
      to: paid.customer.email,
      name: firstName(paid.customer.name),
      bookingId,
      subject: "Your GLAMNET refund",
      heading: "A refund is on its way",
      lead: `We've refunded ${formatMoney(input.refundMinor)} to the card you paid with. It usually shows within 5–10 working days. ${input.note}`,
      facts: [["Appointment", formatAppointment(paid.appointmentStartAt)], ["Refunded", formatMoney(input.refundMinor)]],
      cta: "View booking",
    });
  }

  return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

// --- Reassigning ----------------------------------------------------------------

/**
 * Vendors who could take this booking instead: approved, accepting work,
 * offering every service in it, and free for the whole appointment. Those in
 * the booking's own area come first.
 */
export async function reassignCandidates(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: { select: { serviceId: true } } },
  });
  if (!booking) return [];
  const serviceIds = [...new Set(booking.items.map((item) => item.serviceId))];

  const vendors = await prisma.provider.findMany({
    where: {
      approvalStatus: "APPROVED",
      isAcceptingWork: true,
      ...(booking.providerId ? { id: { not: booking.providerId } } : {}),
      AND: serviceIds.map((serviceId) => ({ services: { some: { serviceId } } })),
      bookings: {
        none: {
          status: { in: BUSY },
          appointmentStartAt: { lt: booking.reservedUntilAt },
          reservedUntilAt: { gt: booking.appointmentStartAt },
        },
      },
      timeOff: { none: { startAt: { lt: booking.reservedUntilAt }, endAt: { gt: booking.appointmentStartAt } } },
    },
    select: { id: true, name: true, rating: true, hubId: true, payoutsEnabled: true, hub: { select: { name: true, city: true } } },
    take: 100,
  });
  return vendors
    .map((vendor) => ({ ...vendor, sameArea: vendor.hubId === booking.hubId }))
    .sort((a, b) => Number(b.sameArea) - Number(a.sameArea) || b.rating - a.rating)
    .slice(0, 40);
}

export const reassignInput = z.object({
  providerId: z.string().min(1),
  note: z.string().trim().min(5, "Say briefly why — both vendors and the customer are told.").max(500),
});

/**
 * Move a booked appointment to another vendor — the original fell ill, was
 * suspended, or can't make it. The price the customer agreed stays; the card
 * hold isn't touched (payment goes to whoever holds the booking when it is
 * captured). The new vendor must be free and offer every service booked.
 */
export async function reassignBooking(actorEmail: string, bookingId: string, raw: unknown) {
  const input = reassignInput.parse(raw);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, email: true } },
      provider: { select: { id: true, name: true, email: true } },
    },
  });
  if (!booking) throw new AdminError("Booking not found.", 404, "NOT_FOUND");
  if (!REASSIGNABLE.includes(booking.status)) {
    throw new AdminError(`A booking that is ${booking.status.toLowerCase().replaceAll("_", " ")} can't be moved to another vendor.`);
  }
  if (booking.paymentStatus === "ESCROW_RELEASED") throw new AdminError("This booking has already been paid out.");
  if (input.providerId === booking.providerId) throw new AdminError("That vendor already has this booking.", 422);

  const candidates = await reassignCandidates(bookingId);
  const next = candidates.find((vendor) => vendor.id === input.providerId);
  if (!next) {
    throw new AdminError("That vendor can't take it: they must be live, offer every service booked and be free at that time.", 422);
  }
  const nextVendor = await prisma.provider.findUniqueOrThrow({ where: { id: next.id }, select: { id: true, name: true, email: true } });
  const when = formatAppointment(booking.appointmentStartAt);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.booking.updateMany({
      where: { id: bookingId, status: booking.status, providerId: booking.providerId },
      data: { providerId: nextVendor.id },
    });
    if (moved.count === 0) throw new AdminError("This booking has just changed. Refresh and try again.");
    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: booking.status,
        toStatus: booking.status,
        actor: "ADMIN",
        note: `Moved from ${booking.provider?.name ?? "no vendor"} to ${nextVendor.name}. ${input.note}`.slice(0, 1_000),
      },
    });
    await tx.notification.createMany({
      data: [
        {
          bookingId,
          audience: "CUSTOMER",
          channel: "PUSH",
          bookingType: booking.bookingType,
          title: "Your booking has a new pro",
          body: `${nextVendor.name} will now look after your ${when} appointment. The price hasn't changed.`,
        },
        {
          bookingId,
          audience: "PROVIDER",
          providerId: nextVendor.id,
          channel: "PUSH",
          bookingType: booking.bookingType,
          title: "A booking has been passed to you",
          body: `The GLAMNET team has given you a ${when} booking. Open it for the details.`,
        },
        ...(booking.providerId
          ? [
              {
                bookingId,
                audience: "PROVIDER",
                providerId: booking.providerId,
                channel: "PUSH",
                bookingType: booking.bookingType,
                title: "A booking was moved",
                body: `Your ${when} booking has been moved to another pro. Please don't travel to it.`,
              },
            ]
          : []),
      ],
    });
  });

  await audit(
    actorEmail,
    "booking.reassign",
    { type: "Booking", id: bookingId },
    `${booking.provider?.name ?? "No vendor"} → ${nextVendor.name} — ${input.note}`,
  );

  await Promise.all([
    deliverBookingNotice({
      to: booking.customer.email,
      name: firstName(booking.customer.name),
      bookingId,
      subject: "Your GLAMNET booking has a new pro",
      heading: "A new pro for your appointment",
      lead: `${booking.provider?.name ?? "Your pro"} can no longer make it, so ${nextVendor.name} will look after you instead. Your time and price are unchanged.${
        booking.serviceLocation === "VENDOR_PREMISES" ? " The address may have changed — open your booking for where to go." : ""
      }`,
      facts: [["Appointment", when], ["New pro", nextVendor.name]],
      cta: "View booking",
    }),
    deliverBookingNotice({
      to: nextVendor.email,
      name: firstName(nextVendor.name),
      bookingId,
      path: `/bookings/${bookingId}`,
      subject: "A GLAMNET booking has been passed to you",
      heading: "A new booking for you",
      lead: `The GLAMNET team has given you this booking. ${input.note}`,
      facts: [["Appointment", when]],
      cta: "View booking",
    }),
    ...(booking.provider
      ? [
          deliverBookingNotice({
            to: booking.provider.email,
            name: firstName(booking.provider.name),
            bookingId,
            path: "/provider",
            subject: "A GLAMNET booking was moved",
            heading: "Booking moved to another pro",
            lead: `Your ${when} booking has been given to another pro. Please don't travel to it. ${input.note}`,
            facts: [["Appointment", when]],
            cta: "Open your dashboard",
          }),
        ]
      : []),
  ]);

  return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
}
