import { ukDateString, ukParts, ukWallClock } from "./uk-time";

/**
 * A vendor's earnings ledger: what each job paid them and what came off it.
 * The earnings page, the CSV download and the printable statement all read
 * these rows, so their totals always agree. Pure, so it can be tested.
 *
 * Money is in pence. For a job:
 *   price + tip − commission − card fee − booking fee = payout
 *   payout − dispute deduction = net
 * which is exactly how settlement works it out (domain/settlement.ts). A
 * GLAMNET-funded promo is not in here: it never touches the vendor's money.
 */

/** The work was done and the vendor is paid, or will be. */
export const EARNED_STATUSES = ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"];

export type LedgerKind = "JOB" | "LATE_CANCELLATION" | "NO_SHOW";

export interface LedgerBooking {
  id: string;
  status: string;
  bookingType: string;
  source: string;
  appointmentStartAt: Date;
  escrowReleasedAt: Date | null;
  services: string[];
  clientName: string;
  totalInvoicePriceMinor: number;
  tipMinor: number;
  platformCommissionMinor: number;
  processingFeeMinor: number;
  trustFeeMinor: number;
  providerPayoutMinor: number;
  providerEmergencyEarningsMinor: number;
  cancellationFeeMinor: number;
  cancellationFeePayoutMinor: number;
  clawbackMinor: number;
}

export interface LedgerRow {
  id: string;
  kind: LedgerKind;
  bookingType: string;
  source: string;
  at: Date;
  paidAt: Date | null;
  services: string;
  /** First name only. */
  client: string;
  priceMinor: number;
  tipMinor: number;
  commissionMinor: number;
  cardFeeMinor: number;
  bookingFeeMinor: number;
  payoutMinor: number;
  /** Taken back after a dispute ruling. */
  deductionMinor: number;
  netMinor: number;
  /** The vendor's share of an emergency surcharge, for the emergency split. */
  surgeMinor: number;
}

/** The row a booking contributes, or null if it earned the vendor nothing. */
export function ledgerRowFor(booking: LedgerBooking): LedgerRow | null {
  const base = {
    id: booking.id,
    bookingType: booking.bookingType,
    source: booking.source,
    at: booking.appointmentStartAt,
    paidAt: booking.escrowReleasedAt,
    services: booking.services.join(" + "),
    client: booking.clientName.split(/\s+/)[0] ?? "",
    deductionMinor: booking.clawbackMinor,
  };

  if (EARNED_STATUSES.includes(booking.status)) {
    return {
      ...base,
      kind: "JOB",
      priceMinor: booking.totalInvoicePriceMinor,
      tipMinor: booking.tipMinor,
      commissionMinor: booking.platformCommissionMinor,
      cardFeeMinor: booking.processingFeeMinor,
      bookingFeeMinor: booking.trustFeeMinor,
      payoutMinor: booking.providerPayoutMinor,
      netMinor: booking.providerPayoutMinor - booking.clawbackMinor,
      surgeMinor: booking.providerEmergencyEarningsMinor,
    };
  }

  // A late cancellation or a missed appointment pays the vendor part of the
  // fee taken from the client's hold.
  if ((booking.status === "CANCELLED" || booking.status === "NO_SHOW") && booking.cancellationFeePayoutMinor > 0) {
    return {
      ...base,
      kind: booking.status === "NO_SHOW" ? "NO_SHOW" : "LATE_CANCELLATION",
      priceMinor: booking.cancellationFeeMinor,
      tipMinor: 0,
      commissionMinor: booking.cancellationFeeMinor - booking.cancellationFeePayoutMinor,
      cardFeeMinor: 0,
      bookingFeeMinor: 0,
      payoutMinor: booking.cancellationFeePayoutMinor,
      netMinor: booking.cancellationFeePayoutMinor - booking.clawbackMinor,
      surgeMinor: 0,
    };
  }

  return null;
}

export interface LedgerTotals {
  count: number;
  priceMinor: number;
  tipMinor: number;
  commissionMinor: number;
  cardFeeMinor: number;
  bookingFeeMinor: number;
  payoutMinor: number;
  deductionMinor: number;
  netMinor: number;
}

export function totalsOf(rows: readonly LedgerRow[]): LedgerTotals {
  const sum = (pick: (row: LedgerRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    count: rows.length,
    priceMinor: sum((row) => row.priceMinor),
    tipMinor: sum((row) => row.tipMinor),
    commissionMinor: sum((row) => row.commissionMinor),
    cardFeeMinor: sum((row) => row.cardFeeMinor),
    bookingFeeMinor: sum((row) => row.bookingFeeMinor),
    payoutMinor: sum((row) => row.payoutMinor),
    deductionMinor: sum((row) => row.deductionMinor),
    netMinor: sum((row) => row.netMinor),
  };
}

export const KIND_LABELS: Record<LedgerKind, string> = {
  JOB: "Job",
  LATE_CANCELLATION: "Late cancellation fee",
  NO_SHOW: "Missed appointment fee",
};

// --- Periods ----------------------------------------------------------------

export type PeriodKey = "7" | "30" | "90" | "tax" | "lasttax";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  tax: "This tax year",
  lasttax: "Last tax year",
};

export function parsePeriod(value: string | undefined | null): PeriodKey {
  return value && value in PERIOD_LABELS ? (value as PeriodKey) : "30";
}

/** The UK tax year (6 April to 5 April) containing `at`, as [start, end). */
export function taxYearOf(at: Date): { from: Date; to: Date; label: string } {
  const p = ukParts(at);
  const startYear = p.month > 4 || (p.month === 4 && p.day >= 6) ? p.year : p.year - 1;
  return {
    from: ukWallClock(startYear, 4, 6),
    to: ukWallClock(startYear + 1, 4, 6),
    label: `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

/** The window a period covers, as [from, to), with a label for headings. */
export function periodRange(period: PeriodKey, now = new Date()): { from: Date; to: Date; label: string } {
  if (period === "tax" || period === "lasttax") {
    const current = taxYearOf(now);
    const year = period === "tax" ? current : taxYearOf(new Date(current.from.getTime() - 86_400_000));
    return { ...year, label: `Tax year ${year.label} (6 Apr–5 Apr)` };
  }
  const days = Number(period);
  return { from: new Date(now.getTime() - days * 86_400_000), to: now, label: PERIOD_LABELS[period] };
}

/** "glamnet-earnings-2026-27.csv" / "glamnet-earnings-last-30-days-2026-10-05.csv". */
export function exportFileName(period: PeriodKey, now = new Date()): string {
  if (period === "tax" || period === "lasttax") {
    return `glamnet-earnings-${periodRange(period, now).label.match(/\d{4}–\d{2}/)?.[0].replace("–", "-")}.csv`;
  }
  return `glamnet-earnings-last-${period}-days-${ukDateString(now)}.csv`;
}

// --- CSV ----------------------------------------------------------------------

/** A cell a spreadsheet will not run as a formula (a client name could be "=…"). */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const pounds = (minor: number) => (minor / 100).toFixed(2);

const SOURCE_LABELS: Record<string, string> = {
  BROADCAST: "Request",
  MARKETPLACE: "Marketplace",
  DIRECT_LINK: "Your link",
};

/** The ledger as CSV: one row per entry, then a totals row. Dates are UK. */
export function ledgerCsv(rows: readonly LedgerRow[]): string {
  const header = [
    "date", "type", "booking_ref", "booked_via", "client", "services",
    "price_gbp", "tip_gbp", "commission_gbp", "card_fee_gbp", "booking_fee_gbp",
    "payout_gbp", "dispute_deduction_gbp", "net_gbp", "paid_out_on",
  ];
  const body = rows.map((row) => [
    ukDateString(row.at),
    KIND_LABELS[row.kind] + (row.bookingType === "EMERGENCY" ? " (emergency)" : ""),
    row.id,
    SOURCE_LABELS[row.source] ?? row.source,
    row.client,
    row.services,
    pounds(row.priceMinor),
    pounds(row.tipMinor),
    pounds(row.commissionMinor),
    pounds(row.cardFeeMinor),
    pounds(row.bookingFeeMinor),
    pounds(row.payoutMinor),
    pounds(row.deductionMinor),
    pounds(row.netMinor),
    row.paidAt ? ukDateString(row.paidAt) : "",
  ]);
  const t = totalsOf(rows);
  const totals = [
    "TOTAL", `${t.count} ${t.count === 1 ? "entry" : "entries"}`, "", "", "", "",
    pounds(t.priceMinor), pounds(t.tipMinor), pounds(t.commissionMinor), pounds(t.cardFeeMinor),
    pounds(t.bookingFeeMinor), pounds(t.payoutMinor), pounds(t.deductionMinor), pounds(t.netMinor), "",
  ];
  // A byte-order mark, so Excel reads the UTF-8 (accented names) correctly.
  return "﻿" + [header, ...body, totals].map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}
