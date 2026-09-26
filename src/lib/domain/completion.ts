/**
 * The contactless completion engine (Open Marketplace Directory §D, Flow 2).
 *
 *   1. The vendor finishes and uploads three photos of the finished work.
 *   2. The server issues a random 4-digit PIN to the customer's screen only.
 *   3. The customer reads it out; the vendor types it in. A match releases
 *      the card hold to the vendor (escrow_released).
 *   4. For 24 hours after release the customer may file a dispute. After
 *      that the booking is closed_uncontestable and the option is gone.
 *
 * The PIN proves the customer was present and satisfied at the end of the
 * appointment, which is what defeats a later "the vendor never came"
 * chargeback.
 */

/** Photos the vendor must upload before a release PIN is issued. */
export const REQUIRED_COMPLETION_PHOTOS = 3;

/** Wrong guesses allowed before the PIN is burned and must be reissued. */
export const MAX_PIN_ATTEMPTS = 5;

/** The dispute window after escrow release. */
export const DISPUTE_WINDOW_HOURS = 24;

const PIN_PATTERN = /^\d{4}$/;

/**
 * Format a random integer as a 4-digit PIN. The caller supplies the
 * randomness (crypto.randomInt on the server) so this stays pure.
 */
export function formatPin(random: number): string {
  const value = Math.abs(Math.trunc(random)) % 10_000;
  return String(value).padStart(4, "0");
}

export function isWellFormedPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/**
 * Compare two PINs without an early exit, so response timing does not reveal
 * how many leading digits were right.
 */
export function pinMatches(expected: string, given: string): boolean {
  if (!isWellFormedPin(expected) || !isWellFormedPin(given)) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ given.charCodeAt(index);
  }
  return difference === 0;
}

export function disputeWindowClosesAt(releasedAt: Date): Date {
  return new Date(releasedAt.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60_000);
}

/** RESOLVED: an admin has ruled on a dispute; final, like CLOSED_UNCONTESTABLE. */
export type SettlementStatus = "OPEN" | "DISPUTED" | "CLOSED_UNCONTESTABLE" | "RESOLVED";

/**
 * Whether the customer may still dispute this booking.
 *
 * Decided from the timestamps, not from the stored settlement status, so the
 * lockout holds to the second even if the sweep that writes
 * CLOSED_UNCONTESTABLE has not run yet.
 */
export function canDispute(
  booking: {
    escrowReleasedAt: Date | null;
    disputeWindowClosesAt: Date | null;
    settlementStatus: string;
  },
  now: Date,
): boolean {
  if (booking.settlementStatus !== "OPEN") return false;
  if (!booking.escrowReleasedAt || !booking.disputeWindowClosesAt) return false;
  return now.getTime() < booking.disputeWindowClosesAt.getTime();
}

/** The settlement status a booking should hold at `now`. */
export function effectiveSettlementStatus(
  booking: {
    disputeWindowClosesAt: Date | null;
    settlementStatus: string;
  },
  now: Date,
): SettlementStatus {
  if (booking.settlementStatus === "DISPUTED") return "DISPUTED";
  if (booking.settlementStatus === "RESOLVED") return "RESOLVED";
  if (booking.settlementStatus === "CLOSED_UNCONTESTABLE") {
    return "CLOSED_UNCONTESTABLE";
  }
  if (
    booking.disputeWindowClosesAt &&
    now.getTime() >= booking.disputeWindowClosesAt.getTime()
  ) {
    return "CLOSED_UNCONTESTABLE";
  }
  return "OPEN";
}
