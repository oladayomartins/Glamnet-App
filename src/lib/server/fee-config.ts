import { cache } from "react";
import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { audit } from "./admin/core";
import {
  DEFAULT_FEE_RATES,
  FEE_RATE_KEYS,
  FEE_RATE_LABELS,
  feeRatesFrom,
  feeRatesProblem,
  formatRate,
  type FeeRates,
} from "@/lib/domain/fee-rates";

/**
 * The commission and fee rates an admin has published (PlatformFeeConfig).
 *
 * The newest row is in force. A booking records the row it was made under
 * (Booking.feeConfigId), and everything that settles or charges it later reads
 * that row — so publishing new rates changes new bookings only.
 */

export interface FeeConfig {
  /** Null when no admin has published rates yet: the defaults apply. */
  id: string | null;
  rates: FeeRates;
  createdAt: Date | null;
  createdBy: string;
  note: string;
}

const DEFAULTS: FeeConfig = { id: null, rates: DEFAULT_FEE_RATES, createdAt: null, createdBy: "", note: "" };

/** The rates in force now. Cached for the length of one request. */
export const getFeeConfig = cache(async (): Promise<FeeConfig> => {
  const row = await prisma.platformFeeConfig.findFirst({ orderBy: { createdAt: "desc" } });
  if (!row) return DEFAULTS;
  return { id: row.id, rates: feeRatesFrom(row), createdAt: row.createdAt, createdBy: row.createdBy, note: row.note };
});

/** The rates in force now, without the bookkeeping. */
export async function currentFeeRates(): Promise<FeeRates> {
  return (await getFeeConfig()).rates;
}

/** The rates a booking was made under: its own row, or the defaults. */
export const ratesForBooking = cache(async (feeConfigId: string | null | undefined): Promise<FeeRates> => {
  if (!feeConfigId) return DEFAULT_FEE_RATES;
  const row = await prisma.platformFeeConfig.findUnique({ where: { id: feeConfigId } });
  return feeRatesFrom(row);
});

export async function feeConfigHistory(take = 10) {
  return prisma.platformFeeConfig.findMany({ orderBy: { createdAt: "desc" }, take });
}

/**
 * Publish new rates. They apply to bookings made from now on; bookings
 * already made keep theirs. The home-visit travel fee is also written to
 * every area, since each area carries its own copy for the booking screens.
 */
export async function publishFeeRates(rates: FeeRates, adminEmail: string, note = "") {
  const problem = feeRatesProblem(rates);
  if (problem) throw new BookingError(problem, "INVALID_TRANSITION", 422);
  const before = (await getFeeConfig()).rates;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.platformFeeConfig.create({
      data: { ...rates, note: note.trim().slice(0, 300), createdBy: adminEmail },
    });
    if (rates.travelFeeMinor !== before.travelFeeMinor) {
      await tx.hub.updateMany({ data: { travelFeeMinor: rates.travelFeeMinor } });
    }
    return created;
  });

  const changes = describeChanges(before, rates);
  await audit(adminEmail, "pricing.fees.publish", { type: "PlatformFeeConfig", id: row.id }, changes || "Republished with no changes");
  return row;
}

/** "New-client commission 30% → 25%; Marketplace booking fee £0.50 → £0.75". */
export function describeChanges(before: FeeRates, after: FeeRates): string {
  return FEE_RATE_KEYS.filter((key) => before[key] !== after[key])
    .map((key) => `${FEE_RATE_LABELS[key]} ${formatRate(key, before[key])} → ${formatRate(key, after[key])}`)
    .join("; ");
}
