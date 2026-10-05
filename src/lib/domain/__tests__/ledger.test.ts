import { describe, expect, it } from "vitest";
import { exportFileName, ledgerCsv, ledgerRowFor, periodRange, taxYearOf, totalsOf, type LedgerBooking } from "../ledger";
import { settle } from "../settlement";

function booking(over: Partial<LedgerBooking>): LedgerBooking {
  return {
    id: "bk_000000000001",
    status: "PAYMENT_RELEASED",
    bookingType: "NORMAL",
    source: "DIRECT_LINK",
    appointmentStartAt: new Date("2026-09-12T10:00:00Z"),
    escrowReleasedAt: new Date("2026-09-12T12:00:00Z"),
    services: ["Gele Tie"],
    clientName: "Jade Whitfield",
    totalInvoicePriceMinor: 3_000,
    tipMinor: 500,
    platformCommissionMinor: 0,
    processingFeeMinor: 70,
    trustFeeMinor: 0,
    providerPayoutMinor: 3_430,
    providerEmergencyEarningsMinor: 0,
    cancellationFeeMinor: 0,
    cancellationFeePayoutMinor: 0,
    clawbackMinor: 0,
    ...over,
  };
}

describe("ledgerRowFor", () => {
  it("breaks a job down so price + tip − fees = payout, as settlement does", () => {
    const s = settle({
      totalMinor: 4_050,
      commissionableMinor: 4_000,
      trustFeeMinor: 50,
      tipMinor: 500,
      commission: { rule: "B", commissionBps: 3_000, firstDiscoveryBooking: true },
    });
    const row = ledgerRowFor(
      booking({
        source: "MARKETPLACE",
        totalInvoicePriceMinor: 4_050,
        tipMinor: 500,
        trustFeeMinor: 50,
        platformCommissionMinor: s.platformCommissionMinor,
        processingFeeMinor: s.processingFeeMinor,
        providerPayoutMinor: s.providerPayoutMinor,
      }),
    )!;
    expect(row.kind).toBe("JOB");
    expect(row.priceMinor + row.tipMinor - row.commissionMinor - row.cardFeeMinor - row.bookingFeeMinor).toBe(row.payoutMinor);
    expect(row.netMinor).toBe(s.providerPayoutMinor);
    expect(row.client).toBe("Jade");
  });

  it("takes a dispute deduction off the net", () => {
    expect(ledgerRowFor(booking({ clawbackMinor: 1_000 }))!.netMinor).toBe(2_430);
  });

  it("includes late-cancellation and missed-appointment fees the vendor was paid", () => {
    const late = ledgerRowFor(booking({ status: "CANCELLED", cancellationFeeMinor: 1_500, cancellationFeePayoutMinor: 1_050 }))!;
    expect(late).toMatchObject({ kind: "LATE_CANCELLATION", priceMinor: 1_500, commissionMinor: 450, payoutMinor: 1_050, tipMinor: 0 });
    expect(ledgerRowFor(booking({ status: "NO_SHOW", cancellationFeeMinor: 3_000, cancellationFeePayoutMinor: 2_100 }))!.kind).toBe("NO_SHOW");
  });

  it("leaves out bookings that paid the vendor nothing", () => {
    expect(ledgerRowFor(booking({ status: "CANCELLED" }))).toBeNull();
    expect(ledgerRowFor(booking({ status: "CONFIRMED" }))).toBeNull();
  });
});

describe("periods", () => {
  it("finds the UK tax year, which starts on 6 April", () => {
    expect(taxYearOf(new Date("2026-04-05T12:00:00Z")).label).toBe("2025–26");
    const year = taxYearOf(new Date("2026-04-06T09:00:00Z"));
    expect(year.label).toBe("2026–27");
    // Midnight UK time, which is 23:00 UTC the day before in summer.
    expect(year.from.toISOString()).toBe("2026-04-05T23:00:00.000Z");
  });

  it("gives last tax year and file names for the download", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(periodRange("lasttax", now).label).toBe("Tax year 2025–26 (6 Apr–5 Apr)");
    expect(exportFileName("tax", now)).toBe("glamnet-earnings-2026-27.csv");
    expect(exportFileName("30", now)).toBe("glamnet-earnings-last-30-days-2026-10-05.csv");
  });
});

describe("ledgerCsv", () => {
  it("writes one line per entry and a totals line that adds up", () => {
    const rows = [booking({}), booking({ id: "bk_2", tipMinor: 0, providerPayoutMinor: 2_940, processingFeeMinor: 60 })]
      .map((entry) => ledgerRowFor(entry)!);
    const lines = ledgerCsv(rows).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^date,type,booking_ref/);
    expect(lines[1]).toContain("2026-09-12,Job,bk_000000000001,Your link,Jade,Gele Tie,30.00,5.00,0.00,0.70,0.00,34.30,0.00,34.30,2026-09-12");
    expect(lines[3]).toBe(`TOTAL,2 entries,,,,,60.00,5.00,0.00,1.30,0.00,63.70,0.00,${(totalsOf(rows).netMinor / 100).toFixed(2)},`);
  });

  it("stops a client name being run as a spreadsheet formula", () => {
    const [row] = [booking({ clientName: "=HYPERLINK(evil)" })].map((entry) => ledgerRowFor(entry)!);
    expect(ledgerCsv([row])).toContain(",'=HYPERLINK(evil),");
  });
});
