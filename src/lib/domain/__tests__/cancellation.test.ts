import { describe, expect, it } from "vitest";
import {
  freeCancellationEndsAt,
  lateCancellationFeeMinor,
  noShowAllowedFrom,
  noShowFeeMinor,
  quoteCustomerCancellation,
  travelInNoShowFeeMinor,
  vendorShareOfFeeMinor,
  type FeeBooking,
} from "../cancellation";

const HOUR = 60 * 60 * 1_000;
const start = new Date("2026-10-10T14:00:00Z");
const at = (hoursBefore: number) => new Date(start.getTime() - hoursBefore * HOUR);

function booking(overrides: Partial<FeeBooking> = {}): FeeBooking {
  return {
    appointmentStartAt: start,
    bookingCreatedAt: at(24 * 7),
    status: "CONFIRMED",
    serviceLocation: "CUSTOMER_ADDRESS",
    subtotalMinor: 6_000,
    emergencySurchargeMinor: 0,
    otherSurchargesMinor: 0,
    travelFeeMinor: 1_000,
    totalInvoicePriceMinor: 7_050,
    tipMinor: 0,
    discountMinor: 0,
    ...overrides,
  };
}

describe("customer cancellation", () => {
  it("is free before any vendor has taken the booking", () => {
    const quote = quoteCustomerCancellation(booking({ status: "BROADCAST" }), at(1));
    expect(quote).toMatchObject({ allowed: true, kind: "FREE", feeMinor: 0 });
  });

  it("is free until 24 hours before, and costs half the services after", () => {
    expect(quoteCustomerCancellation(booking(), at(24.01))).toMatchObject({ kind: "FREE", feeMinor: 0 });
    expect(quoteCustomerCancellation(booking(), at(24))).toMatchObject({ kind: "LATE", feeMinor: 3_000 });
    expect(quoteCustomerCancellation(booking(), at(2))).toMatchObject({ kind: "LATE", feeMinor: 3_000 });
  });

  it("gives 15 minutes' grace on a booking made less than a day ahead", () => {
    const shortNotice = booking({ bookingCreatedAt: at(5) });
    expect(quoteCustomerCancellation(shortNotice, at(4.8))).toMatchObject({ kind: "FREE" });
    expect(quoteCustomerCancellation(shortNotice, at(4.7))).toMatchObject({ kind: "LATE" });
  });

  it("charges as a missed appointment once the vendor is on the way", () => {
    const quote = quoteCustomerCancellation(booking({ status: "PROVIDER_EN_ROUTE", bookingCreatedAt: at(1) }), at(0.5));
    // Services in full, plus the travel the vendor is already spending.
    expect(quote).toMatchObject({ kind: "MISSED", feeMinor: 7_000 });
  });

  it("charges as a missed appointment after the start time", () => {
    expect(quoteCustomerCancellation(booking(), at(-0.25))).toMatchObject({ kind: "MISSED" });
  });

  it("can't be done in the app once the vendor has arrived", () => {
    expect(quoteCustomerCancellation(booking({ status: "ARRIVED" }), at(0)).allowed).toBe(false);
    expect(quoteCustomerCancellation(booking({ status: "COMPLETED" }), at(-2)).allowed).toBe(false);
  });

  it("puts the deadline 24 hours before the start", () => {
    expect(freeCancellationEndsAt(start)).toEqual(at(24));
  });
});

describe("fees", () => {
  it("count surcharges as service but never the trust fee or tip", () => {
    const b = booking({ emergencySurchargeMinor: 2_000, tipMinor: 500, totalInvoicePriceMinor: 9_050 });
    expect(lateCancellationFeeMinor(b)).toBe(4_000);
    expect(noShowFeeMinor(b)).toBe(9_000);
  });

  it("leave travel out at the vendor's own workspace", () => {
    const b = booking({ serviceLocation: "VENDOR_PREMISES", travelFeeMinor: 0, totalInvoicePriceMinor: 6_050 });
    expect(noShowFeeMinor(b)).toBe(6_000);
    expect(travelInNoShowFeeMinor(b)).toBe(0);
  });

  it("never exceed what the card is charged", () => {
    const b = booking({ discountMinor: 2_000 });
    expect(noShowFeeMinor(b)).toBe(5_050);
  });
});

describe("the vendor's share of a fee", () => {
  it("takes the discovery commission off the service part only", () => {
    expect(
      vendorShareOfFeeMinor({ feeMinor: 7_000, travelInFeeMinor: 1_000, commissionBps: 3_000, firstDiscoveryBooking: true }),
    ).toBe(7_000 - 1_800);
  });

  it("takes only the card fee on a direct or repeat booking", () => {
    expect(
      vendorShareOfFeeMinor({ feeMinor: 3_000, travelInFeeMinor: 0, commissionBps: 0, firstDiscoveryBooking: false }),
    ).toBe(3_000 - 60);
  });
});

describe("no-shows", () => {
  it("need the vendor at the door of a home visit, and 15 minutes' wait", () => {
    expect(noShowAllowedFrom(booking({ status: "PROVIDER_EN_ROUTE" }), null)).toBeNull();
    expect(noShowAllowedFrom(booking({ status: "ARRIVED" }), at(0.5))).toEqual(at(-0.25));
  });

  it("count the wait from a late vendor's arrival", () => {
    expect(noShowAllowedFrom(booking({ status: "ARRIVED" }), at(-1))).toEqual(at(-1.25));
  });

  it("apply at the vendor's workspace while the client isn't checked in", () => {
    const premises = booking({ serviceLocation: "VENDOR_PREMISES" });
    expect(noShowAllowedFrom(premises, null)).toEqual(at(-0.25));
    expect(noShowAllowedFrom({ ...premises, status: "ARRIVED" }, null)).toBeNull();
  });
});
