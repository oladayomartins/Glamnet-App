import { applyBps } from "./pricing";

/**
 * The dual-commission payout protocol (Open Marketplace Directory §D).
 *
 *   Rule A — the direct link. The client came through the vendor's own
 *   /pro/:slug link, or has booked this vendor before. No marketplace
 *   commission: the vendor receives everything except the platform trust fee
 *   and a 2% card processing fee.
 *
 *   Rule B — the discovery matrix. A new client found the vendor through
 *   GLAMNET's own marketplace (the directory or the emergency broadcast). A
 *   flat 30% acquisition commission is taken from the service work; the vendor
 *   keeps the other 70%, their travel fee, and 100% of any tip. Only the first
 *   booking between a client and a vendor can be Rule B — every later booking
 *   defaults to Rule A, whatever route it came by.
 *
 * All money is integer pence, and every function here is pure so the split is
 * testable without a payment provider.
 */

export type BookingSource = "BROADCAST" | "MARKETPLACE" | "DIRECT_LINK";

export const BOOKING_SOURCES: readonly BookingSource[] = [
  "BROADCAST",
  "MARKETPLACE",
  "DIRECT_LINK",
];

/** Rule B: the acquisition commission on a first discovery booking. */
export const DISCOVERY_COMMISSION_BPS = 3_000;

/** Rule A: no marketplace commission. */
export const DIRECT_COMMISSION_BPS = 0;

/**
 * Card processing fee passed on to the vendor under Rule A (spec: "minus a
 * basic 2% Stripe processing card fee"). Under Rule B the platform absorbs it
 * from its commission, as the spec passes the vendor "the remaining 70%".
 */
export const CARD_PROCESSING_FEE_BPS = 200;

export interface CommissionDecision {
  rule: "A" | "B";
  /** The spec's `first_discovery_booking` flag. */
  firstDiscoveryBooking: boolean;
  commissionBps: number;
}

/**
 * Which rule applies to a booking.
 *
 * `hasPriorBooking` means this customer already has a real booking (accepted
 * or later, not cancelled) with this vendor — they are no longer a new client
 * the marketplace acquired.
 */
export function decideCommission(input: {
  source: BookingSource;
  hasPriorBooking: boolean;
}): CommissionDecision {
  const discovery = input.source !== "DIRECT_LINK" && !input.hasPriorBooking;
  return discovery
    ? {
        rule: "B",
        firstDiscoveryBooking: true,
        commissionBps: DISCOVERY_COMMISSION_BPS,
      }
    : {
        rule: "A",
        firstDiscoveryBooking: false,
        commissionBps: DIRECT_COMMISSION_BPS,
      };
}

export interface SettlementInput {
  /** The invoice total the customer is charged, before any tip. */
  totalMinor: number;
  /** Services + add-ons + emergency and other surcharges: the work itself. */
  commissionableMinor: number;
  /** The platform's fixed trust fee. Never paid out. */
  trustFeeMinor: number;
  tipMinor: number;
  commission: CommissionDecision;
}

export interface Settlement {
  /** What the card is charged: total plus tip. */
  chargeMinor: number;
  platformCommissionMinor: number;
  processingFeeMinor: number;
  /** Transferred to the vendor's connected account at escrow release. */
  providerPayoutMinor: number;
  /** Kept by the platform: trust fee + commission + processing fee. */
  platformRetainedMinor: number;
}

/** Split one booking's money between the vendor and the platform. */
export function settle(input: SettlementInput): Settlement {
  const tipMinor = Math.max(0, Math.round(input.tipMinor));
  const chargeMinor = input.totalMinor + tipMinor;

  const platformCommissionMinor = applyBps(
    input.commissionableMinor,
    input.commission.commissionBps,
  );
  const processingFeeMinor =
    input.commission.rule === "A"
      ? applyBps(chargeMinor, CARD_PROCESSING_FEE_BPS)
      : 0;

  const providerPayoutMinor = Math.max(
    0,
    chargeMinor -
      input.trustFeeMinor -
      platformCommissionMinor -
      processingFeeMinor,
  );

  return {
    chargeMinor,
    platformCommissionMinor,
    processingFeeMinor,
    providerPayoutMinor,
    platformRetainedMinor: chargeMinor - providerPayoutMinor,
  };
}

/** Tips are bounded so a slip of the thumb cannot authorise £9,999. */
export const MAX_TIP_MINOR = 50_000;
