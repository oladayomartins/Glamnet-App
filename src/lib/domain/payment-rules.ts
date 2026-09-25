/**
 * When a card is held, and how a dispute ruling turns into money movements.
 *
 * Pure: no database, no gateway. The payment flow and the admin dispute
 * screen both use these, so what the admin previews is what is carried out.
 */

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * How close to the appointment a hold is placed.
 *
 * Stripe cancels an uncaptured card authorisation after about seven days. A
 * hold placed five days out leaves two days for the appointment to run late
 * and the PIN to be entered before it lapses.
 */
export const HOLD_LEAD_DAYS = 5;

/**
 * A booking whose card still isn't held this close to the appointment is
 * cancelled, so the vendor isn't left travelling to an unpaid job.
 */
export const UNSECURED_CANCEL_HOURS = 24;

/** Whether checkout should save the card for later rather than hold it now. */
export function needsSavedCard(appointmentStartAt: Date, now = new Date()): boolean {
  return appointmentStartAt.getTime() - now.getTime() > HOLD_LEAD_DAYS * DAY_MS;
}

/** Whether a saved card is now due its hold. */
export function holdIsDue(appointmentStartAt: Date, now = new Date()): boolean {
  return !needsSavedCard(appointmentStartAt, now);
}

/** What the customer's card is held for: the invoice, plus tip, less any promo. */
export function chargeMinorOf(booking: {
  totalInvoicePriceMinor: number;
  tipMinor: number;
  discountMinor: number;
}): number {
  return booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor;
}

/**
 * Where the money is when a dispute is ruled on.
 *
 * HELD: the hold is still uncaptured (the customer disputed before giving
 * the PIN). RELEASED: captured and paid out. NONE: no card money at all.
 */
export type DisputeStage = "HELD" | "RELEASED" | "NONE";

export function disputeStageOf(paymentStatus: string): DisputeStage {
  if (paymentStatus === "AUTHORISED" || paymentStatus === "CARD_SAVED") return "HELD";
  if (paymentStatus === "ESCROW_RELEASED") return "RELEASED";
  return "NONE";
}

export interface DisputeRuling {
  /** Back to (or never taken from) the customer. */
  refundMinor: number;
  /** Not paid to, or taken back from, the vendor. */
  clawbackMinor: number;
}

export interface DisputePlan extends DisputeRuling {
  stage: DisputeStage;
  /** HELD only: what is captured from the hold (0 = release it entirely). */
  captureMinor: number;
  /** What the vendor ends up with. */
  vendorPayMinor: number;
  /** What GLAMNET absorbs: refunded to the customer but not recovered. */
  platformCostMinor: number;
  paymentStatus: string;
  /** Where the booking ends up. */
  bookingStatus: "PAYMENT_RELEASED" | "CANCELLED";
}

export class DisputeRulingError extends Error {}

/**
 * Turn an admin's ruling into the exact movements to make, or say why it
 * can't be done. Amounts are whole pence.
 */
export function planDisputeRuling(input: {
  stage: DisputeStage;
  chargeMinor: number;
  payoutMinor: number;
  ruling: DisputeRuling;
}): DisputePlan {
  const { stage, chargeMinor, payoutMinor } = input;
  const refundMinor = Math.round(input.ruling.refundMinor);
  const clawbackMinor = Math.round(input.ruling.clawbackMinor);

  if (refundMinor < 0 || clawbackMinor < 0) {
    throw new DisputeRulingError("Amounts can't be negative.");
  }
  if (refundMinor > chargeMinor) {
    throw new DisputeRulingError("The refund can't be more than the customer paid.");
  }
  if (clawbackMinor > payoutMinor) {
    throw new DisputeRulingError("You can't recover more than the vendor was paid.");
  }
  if (stage === "NONE" && (refundMinor > 0 || clawbackMinor > 0)) {
    throw new DisputeRulingError("There's no card payment on this booking to refund.");
  }

  const vendorPayMinor = payoutMinor - clawbackMinor;
  const captureMinor = stage === "HELD" ? chargeMinor - refundMinor : 0;
  // Before release the vendor is paid out of what is captured, so they can't
  // be paid more than the customer is charged.
  if (stage === "HELD" && vendorPayMinor > captureMinor) {
    throw new DisputeRulingError(
      "The vendor would be paid more than the customer is charged. Recover more from the vendor, or refund less.",
    );
  }

  const fullyRefunded = refundMinor === chargeMinor && chargeMinor > 0;
  const paymentStatus =
    stage === "HELD"
      ? captureMinor === 0
        ? "VOIDED"
        : "ESCROW_RELEASED"
      : stage === "RELEASED"
        ? fullyRefunded
          ? "REFUNDED"
          : refundMinor > 0
            ? "PARTIALLY_REFUNDED"
            : "ESCROW_RELEASED"
        : "NONE";

  return {
    stage,
    refundMinor,
    clawbackMinor,
    captureMinor,
    vendorPayMinor,
    platformCostMinor: Math.max(0, refundMinor - clawbackMinor),
    paymentStatus,
    bookingStatus: fullyRefunded && vendorPayMinor === 0 ? "CANCELLED" : "PAYMENT_RELEASED",
  };
}
