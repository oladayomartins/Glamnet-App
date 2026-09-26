import { z } from "zod";
import { prisma } from "../prisma";
import { paymentGateway, PaymentError } from "../payments";
import { holdSavedCard } from "../payment-flow";
import { deliverBookingNotice } from "../notifications";
import {
  disputedAmountsOf,
  disputeStageOf,
  DisputeRulingError,
  planDisputeRuling,
  type DisputePlan,
} from "@/lib/domain/payment-rules";
import { formatMoney } from "@/lib/domain/pricing";
import { AdminError, audit } from "./core";

/**
 * An admin's ruling on a service dispute.
 *
 * The admin sets two amounts: what the customer gets back, and what is
 * recovered from the vendor. What that means in Stripe depends on where the
 * money is (see planDisputeRuling):
 *
 *   before release (hold uncaptured) → capture only what's owed, pay the
 *                                      vendor their reduced share, and let
 *                                      the rest of the hold go;
 *   after release                    → refund the customer, and reverse part
 *                                      of the vendor's transfer.
 *
 * GLAMNET absorbs any refund it doesn't recover from the vendor. Money moves
 * first and the record after, so a booking never says "refunded" for a refund
 * that didn't happen. Final: a resolved dispute can't be reopened here.
 */

export const rulingInput = z.object({
  refundMinor: z.number().int().min(0).max(10_000_000),
  clawbackMinor: z.number().int().min(0).max(10_000_000),
  note: z.string().trim().min(5, "Say briefly why — both sides see this.").max(1_000),
});

/** The numbers the ruling form needs, and a preview of any ruling. */
export async function disputeFacts(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AdminError("Booking not found.", 404, "NOT_FOUND");
  const { chargeMinor, payoutMinor, feeOnly } = disputedAmountsOf(booking);
  return { stage: disputeStageOf(booking.paymentStatus), chargeMinor, payoutMinor, feeOnly };
}

export async function resolveDispute(actorEmail: string, bookingId: string, raw: unknown) {
  const input = rulingInput.parse(raw);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, email: true } },
      provider: { select: { id: true, name: true, email: true, stripeAccountId: true, payoutsEnabled: true } },
    },
  });
  if (!booking) throw new AdminError("Booking not found.", 404, "NOT_FOUND");
  if (booking.status !== "DISPUTED" || booking.settlementStatus !== "DISPUTED") {
    throw new AdminError("This booking isn't under dispute.");
  }

  // On a cancelled or missed booking the dispute is about the fee alone, and
  // the booking stays cancelled or missed whatever the ruling.
  const amounts = disputedAmountsOf(booking);
  let plan: DisputePlan;
  try {
    plan = planDisputeRuling({
      stage: disputeStageOf(booking.paymentStatus),
      chargeMinor: amounts.chargeMinor,
      payoutMinor: amounts.payoutMinor,
      ruling: { refundMinor: input.refundMinor, clawbackMinor: input.clawbackMinor },
    });
  } catch (error) {
    if (error instanceof DisputeRulingError) throw new AdminError(error.message, 422);
    throw error;
  }
  const finalStatus = amounts.feeOnly ? (booking.noShowAt ? "NO_SHOW" : "CANCELLED") : plan.bookingStatus;

  const gateway = paymentGateway();
  const money = { transferId: booking.transferId, refundId: "", transferReversalId: "", captured: false };

  try {
    if (plan.stage === "HELD") {
      let paymentIntentId = booking.paymentIntentId;
      // A far-off booking whose card was saved but not yet held: hold it now,
      // if anything is to be taken at all.
      if (booking.paymentStatus === "CARD_SAVED" && plan.captureMinor > 0) {
        if (!(await holdSavedCard(booking.id))) {
          throw new AdminError("The customer's saved card couldn't be charged, so nothing can be captured. Refund in full instead.");
        }
        paymentIntentId = (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentIntentId;
      }

      if (plan.captureMinor === 0) {
        if (paymentIntentId) await gateway.void(paymentIntentId);
      } else {
        if (
          gateway.mode === "stripe" &&
          plan.vendorPayMinor > 0 &&
          (!booking.provider?.stripeAccountId || !booking.provider.payoutsEnabled)
        ) {
          throw new AdminError("The vendor hasn't finished their payout set-up, so they can't be paid yet.");
        }
        const { transferId } = await gateway.captureAndTransfer({
          bookingId: booking.id,
          paymentIntentId,
          destinationAccountId: booking.provider?.stripeAccountId || `sim_acct_${booking.providerId}`,
          payoutMinor: plan.vendorPayMinor,
          captureMinor: plan.captureMinor,
        });
        money.transferId = transferId;
        money.captured = true;
      }
    } else if (plan.stage === "RELEASED") {
      if (plan.refundMinor > 0) {
        ({ refundId: money.refundId } = await gateway.refund({
          bookingId: booking.id,
          paymentIntentId: booking.paymentIntentId,
          amountMinor: plan.refundMinor,
        }));
      }
      if (plan.clawbackMinor > 0) {
        if (!booking.transferId) {
          throw new AdminError("There's no transfer to the vendor on record to recover from.");
        }
        ({ reversalId: money.transferReversalId } = await gateway.reverseTransfer({
          bookingId: booking.id,
          transferId: booking.transferId,
          amountMinor: plan.clawbackMinor,
        }));
      }
    }
  } catch (error) {
    if (error instanceof PaymentError) throw new AdminError(`Stripe refused: ${error.message}`, 502);
    throw error;
  }

  const now = new Date();
  const summary = rulingSummary(plan);
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, status: "DISPUTED", settlementStatus: "DISPUTED" },
      data: {
        status: finalStatus,
        settlementStatus: "RESOLVED",
        refundedMinor: plan.refundMinor,
        clawbackMinor: plan.clawbackMinor,
        refundId: money.refundId,
        transferReversalId: money.transferReversalId,
        transferId: money.transferId,
        ...(plan.stage !== "NONE" ? { paymentStatus: plan.paymentStatus } : {}),
        ...(money.captured && !booking.escrowReleasedAt ? { escrowReleasedAt: now } : {}),
        disputeResolution: input.note,
        disputeResolvedAt: now,
        disputeResolvedBy: actorEmail,
        completionPin: "",
      },
    });
    if (claimed.count === 0) throw new AdminError("Someone else has just resolved this dispute.");
    await tx.bookingStatusEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: "DISPUTED",
        toStatus: finalStatus,
        actor: "ADMIN",
        note: `Dispute resolved: ${summary}. ${input.note}`.slice(0, 1_000),
      },
    });
    await tx.notification.createMany({
      data: [
        {
          bookingId: booking.id,
          audience: "CUSTOMER",
          channel: "PUSH",
          bookingType: booking.bookingType,
          title: "Your dispute has been resolved",
          body: plan.refundMinor > 0 ? `${formatMoney(plan.refundMinor)} is coming back to you.` : "The team reviewed it; no refund was due.",
        },
        ...(booking.providerId
          ? [
              {
                bookingId: booking.id,
                audience: "PROVIDER",
                providerId: booking.providerId,
                channel: "PUSH",
                bookingType: booking.bookingType,
                title: "A dispute on your booking was resolved",
                body:
                  plan.clawbackMinor > 0
                    ? `${formatMoney(plan.clawbackMinor)} was deducted from your payout.`
                    : "Your payout stands.",
              },
            ]
          : []),
      ],
    });
    return tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
  });

  await audit(actorEmail, "booking.dispute.resolve", { type: "Booking", id: booking.id }, summary);

  await deliverBookingNotice({
    to: booking.customer.email,
    name: booking.customer.name.split(/\s+/)[0] || booking.customer.name,
    bookingId: booking.id,
    subject: "Your GLAMNET dispute has been resolved",
    heading: "Dispute resolved",
    lead:
      plan.refundMinor > 0
        ? `We've reviewed your booking. ${formatMoney(plan.refundMinor)} ${plan.stage === "RELEASED" ? "is being refunded to your card — banks usually take 5–10 working days" : "has been taken off what you're charged"}.`
        : "We've reviewed your booking and the photos from the appointment, and no refund was due this time.",
    facts: [["Our note", input.note]],
    cta: "View booking",
  });
  if (booking.provider) {
    await deliverBookingNotice({
      to: booking.provider.email,
      name: booking.provider.name.split(/\s+/)[0] || booking.provider.name,
      bookingId: booking.id,
      subject: "A dispute on your GLAMNET booking has been resolved",
      heading: "Dispute resolved",
      lead:
        plan.clawbackMinor > 0
          ? `We've reviewed the client's dispute. ${formatMoney(plan.clawbackMinor)} has been deducted from your payout for this booking.`
          : `We've reviewed the client's dispute and your payout of ${formatMoney(plan.vendorPayMinor)} stands.`,
      facts: [["Our note", input.note]],
      cta: "View booking",
    });
  }

  return updated;
}

/** One line for the audit log and timeline. */
function rulingSummary(plan: DisputePlan): string {
  const parts = [
    plan.refundMinor > 0 ? `customer refunded ${formatMoney(plan.refundMinor)}` : "no refund",
    plan.clawbackMinor > 0 ? `${formatMoney(plan.clawbackMinor)} recovered from vendor` : "vendor payout unchanged",
  ];
  if (plan.platformCostMinor > 0) parts.push(`GLAMNET absorbs ${formatMoney(plan.platformCostMinor)}`);
  return parts.join("; ");
}
