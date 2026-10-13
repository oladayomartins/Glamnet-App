import { describe, expect, it } from "vitest";
import { DEFAULT_FEE_RATES, feeRatesFrom, feeRatesProblem, formatRate, type FeeRates } from "../fee-rates";
import { decideCommission, settle, trustFeeFor } from "../settlement";
import {
  lateCancellationFeeMinor,
  noShowFeeMinor,
  policySummary,
  quoteCustomerCancellation,
  vendorShareOfFeeMinor,
  type FeeBooking,
} from "../cancellation";

const custom: FeeRates = {
  discoveryCommissionBps: 2_000,
  repeatCommissionBps: 500,
  cardFeeBps: 300,
  trustFeeMinor: 99,
  directTrustFeeMinor: 25,
  lateCancellationFeeBps: 2_500,
  noShowFeeBps: 7_500,
  travelFeeMinor: 700,
};

describe("fee rates", () => {
  it("defaults to the launch rates and fills gaps from a stored row", () => {
    expect(feeRatesFrom(null)).toEqual(DEFAULT_FEE_RATES);
    expect(feeRatesFrom({ discoveryCommissionBps: 2_500 })).toEqual({ ...DEFAULT_FEE_RATES, discoveryCommissionBps: 2_500 });
  });

  it("refuses rates out of range, with a plain name", () => {
    expect(feeRatesProblem(DEFAULT_FEE_RATES)).toBeNull();
    expect(feeRatesProblem({ ...DEFAULT_FEE_RATES, discoveryCommissionBps: 10_001 })).toBe("New-client commission can be at most 100%.");
    expect(feeRatesProblem({ ...DEFAULT_FEE_RATES, trustFeeMinor: -1 })).toBe("Marketplace booking fee can't be negative.");
    expect(feeRatesProblem({ ...DEFAULT_FEE_RATES, noShowFeeBps: 2_000 })).toMatch(/can't cost less/);
    expect(formatRate("cardFeeBps", 250)).toBe("2.5%");
    expect(formatRate("trustFeeMinor", 75)).toBe("£0.75");
  });

  it("drives commission, card fee and booking fee", () => {
    expect(decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }, custom)).toMatchObject({ rule: "B", commissionBps: 2_000 });
    expect(decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false }, custom)).toMatchObject({ rule: "A", commissionBps: 500 });
    expect(trustFeeFor("BROADCAST", custom)).toBe(99);
    expect(trustFeeFor("DIRECT_LINK", custom)).toBe(25);

    // £100 through the vendor's own link: 5% commission and a 3% card fee.
    const direct = settle({
      totalMinor: 10_025,
      commissionableMinor: 10_000,
      trustFeeMinor: 25,
      tipMinor: 0,
      commission: decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false }, custom),
    });
    expect(direct.platformCommissionMinor).toBe(500);
    expect(direct.processingFeeMinor).toBe(301);
    expect(direct.providerPayoutMinor).toBe(10_025 - 25 - 500 - 301);

    // £100 for a new marketplace client: 20%, card fee covered by GLAMNET.
    const discovery = settle({
      totalMinor: 10_099,
      commissionableMinor: 10_000,
      trustFeeMinor: 99,
      tipMinor: 0,
      commission: decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }, custom),
    });
    expect(discovery.processingFeeMinor).toBe(0);
    expect(discovery.providerPayoutMinor).toBe(8_000);
  });

  it("drives the cancellation fees and their wording", () => {
    const booking: FeeBooking = {
      appointmentStartAt: new Date("2026-10-10T12:00:00Z"),
      bookingCreatedAt: new Date("2026-10-01T12:00:00Z"),
      status: "CONFIRMED",
      serviceLocation: "CUSTOMER_ADDRESS",
      subtotalMinor: 10_000,
      emergencySurchargeMinor: 0,
      otherSurchargesMinor: 0,
      travelFeeMinor: 700,
      totalInvoicePriceMinor: 10_799,
      tipMinor: 0,
      discountMinor: 0,
    };
    expect(lateCancellationFeeMinor(booking, custom)).toBe(2_500);
    expect(noShowFeeMinor(booking, custom)).toBe(7_500 + 700);
    const quote = quoteCustomerCancellation(booking, new Date("2026-10-10T00:00:00Z"), custom);
    expect(quote).toMatchObject({ allowed: true, kind: "LATE", feeMinor: 2_500 });
    expect(quote.allowed && quote.explanation).toMatch(/25% of the service price/);
    expect(policySummary(custom)).toMatch(/25% of the service price, and a missed appointment costs 75%/);
    expect(vendorShareOfFeeMinor({ feeMinor: 2_500, travelInFeeMinor: 0, commissionBps: 500, firstDiscoveryBooking: false, cardFeeBps: 300 })).toBe(2_500 - 125 - 75);
  });

  it("keeps today's numbers when no rates are passed", () => {
    expect(trustFeeFor("MARKETPLACE")).toBe(50);
    expect(policySummary()).toMatch(/50% of the service price, and a missed appointment is charged in full/);
  });
});
