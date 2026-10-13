/**
 * The commission and fee rates the money runs on, as one value. An admin sets
 * them (PlatformFeeConfig); with nothing set, these defaults apply — they are
 * the rates the marketplace launched with.
 *
 * Every pricing, settlement and cancellation function takes a FeeRates
 * argument rather than reading a constant, so a rate an admin publishes is the
 * rate a booking is charged, and a booking made before the change keeps the
 * rates it was made under.
 */

export interface FeeRates {
  /** Rule B: new client found through the marketplace or an emergency request. Basis points. */
  discoveryCommissionBps: number;
  /** Rule A: the vendor's own link and repeat clients. Basis points. */
  repeatCommissionBps: number;
  /** Card processing fee taken from the vendor's payout under Rule A. Basis points. */
  cardFeeBps: number;
  /** Client booking fee on marketplace and emergency bookings. Pence. */
  trustFeeMinor: number;
  /** Client booking fee on a booking through the vendor's own link. Pence. */
  directTrustFeeMinor: number;
  /** Late cancellation, as a share of the service price. Basis points. */
  lateCancellationFeeBps: number;
  /** Missed appointment, as a share of the service price (plus travel). Basis points. */
  noShowFeeBps: number;
  /** Home-visit travel fee. Pence. */
  travelFeeMinor: number;
}

export const DEFAULT_FEE_RATES: FeeRates = {
  discoveryCommissionBps: 3_000,
  repeatCommissionBps: 0,
  cardFeeBps: 200,
  trustFeeMinor: 50,
  directTrustFeeMinor: 0,
  lateCancellationFeeBps: 5_000,
  noShowFeeBps: 10_000,
  travelFeeMinor: 500,
};

/**
 * What an admin may set each rate to. Percentages cap at 100% (a 100%
 * commission or fee still leaves the vendor's travel and tips, and a fee is
 * never more than the card was charged). Money caps are a guard against a
 * stray zero, not policy.
 */
export const FEE_RATE_LIMITS: Record<keyof FeeRates, { max: number; unit: "bps" | "pence" }> = {
  discoveryCommissionBps: { max: 10_000, unit: "bps" },
  repeatCommissionBps: { max: 10_000, unit: "bps" },
  cardFeeBps: { max: 1_000, unit: "bps" },
  trustFeeMinor: { max: 5_000, unit: "pence" },
  directTrustFeeMinor: { max: 5_000, unit: "pence" },
  lateCancellationFeeBps: { max: 10_000, unit: "bps" },
  noShowFeeBps: { max: 10_000, unit: "bps" },
  travelFeeMinor: { max: 10_000, unit: "pence" },
};

export const FEE_RATE_KEYS = Object.keys(DEFAULT_FEE_RATES) as (keyof FeeRates)[];

/** Plain names, for admin screens, errors and the audit log. */
export const FEE_RATE_LABELS: Record<keyof FeeRates, string> = {
  discoveryCommissionBps: "New-client commission",
  repeatCommissionBps: "Own-link and repeat commission",
  cardFeeBps: "Card processing fee",
  trustFeeMinor: "Marketplace booking fee",
  directTrustFeeMinor: "Own-link booking fee",
  lateCancellationFeeBps: "Late cancellation fee",
  noShowFeeBps: "Missed appointment fee",
  travelFeeMinor: "Travel fee",
};

/** "30%" for a rate, "£0.50" for an amount. */
export function formatRate(key: keyof FeeRates, value: number): string {
  return key.endsWith("Bps") ? percent(value) : `£${(value / 100).toFixed(2)}`;
}

/** A row from the database (or nothing) as FeeRates. */
export function feeRatesFrom(row: Partial<FeeRates> | null | undefined): FeeRates {
  if (!row) return DEFAULT_FEE_RATES;
  const rates = { ...DEFAULT_FEE_RATES };
  for (const key of FEE_RATE_KEYS) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) rates[key] = value;
  }
  return rates;
}

/** Why a set of rates can't be published, or null. */
export function feeRatesProblem(rates: FeeRates): string | null {
  for (const key of FEE_RATE_KEYS) {
    const value = rates[key];
    const limit = FEE_RATE_LIMITS[key];
    const name = FEE_RATE_LABELS[key];
    if (!Number.isInteger(value) || value < 0) return `${name} can't be negative.`;
    if (value > limit.max) return `${name} can be at most ${formatRate(key, limit.max)}.`;
  }
  if (rates.noShowFeeBps < rates.lateCancellationFeeBps) {
    return "A missed appointment can't cost less than a late cancellation.";
  }
  return null;
}

/** "30%", "2.5%", "0%". */
export function percent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}
