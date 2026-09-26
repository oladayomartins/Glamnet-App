import { describe, expect, it } from "vitest";
import {
  chargeMinorOf,
  disputeStageOf,
  holdIsDue,
  needsSavedCard,
  planDisputeRuling,
} from "../payment-rules";

const now = new Date("2026-10-01T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);

describe("when a card is held", () => {
  it("holds now for anything within five days", () => {
    expect(needsSavedCard(inDays(0.1), now)).toBe(false);
    expect(needsSavedCard(inDays(5), now)).toBe(false);
  });

  it("saves the card for anything further off, and holds it once due", () => {
    expect(needsSavedCard(inDays(5.01), now)).toBe(true);
    expect(needsSavedCard(inDays(40), now)).toBe(true);
    expect(holdIsDue(inDays(40), now)).toBe(false);
    expect(holdIsDue(inDays(4.9), now)).toBe(true);
  });

  it("holds the invoice plus tip less promo", () => {
    expect(chargeMinorOf({ totalInvoicePriceMinor: 10_000, tipMinor: 500, discountMinor: 1_000 })).toBe(9_500);
  });
});

describe("planDisputeRuling", () => {
  const held = { stage: "HELD" as const, chargeMinor: 10_000, payoutMinor: 8_000 };
  const released = { stage: "RELEASED" as const, chargeMinor: 10_000, payoutMinor: 8_000 };

  it("siding with the vendor before release captures everything", () => {
    const plan = planDisputeRuling({ ...held, ruling: { refundMinor: 0, clawbackMinor: 0 } });
    expect(plan).toMatchObject({ captureMinor: 10_000, vendorPayMinor: 8_000, paymentStatus: "ESCROW_RELEASED", bookingStatus: "PAYMENT_RELEASED" });
  });

  it("a full refund before release lets the hold go and pays nobody", () => {
    const plan = planDisputeRuling({ ...held, ruling: { refundMinor: 10_000, clawbackMinor: 8_000 } });
    expect(plan).toMatchObject({ captureMinor: 0, vendorPayMinor: 0, paymentStatus: "VOIDED", bookingStatus: "CANCELLED", platformCostMinor: 2_000 });
  });

  it("a partial refund before release captures the rest", () => {
    const plan = planDisputeRuling({ ...held, ruling: { refundMinor: 3_000, clawbackMinor: 2_400 } });
    expect(plan).toMatchObject({ captureMinor: 7_000, vendorPayMinor: 5_600, platformCostMinor: 600 });
  });

  it("won't pay the vendor more than is captured", () => {
    expect(() => planDisputeRuling({ ...held, ruling: { refundMinor: 5_000, clawbackMinor: 0 } })).toThrow(/more than the customer is charged/);
  });

  it("after release, refunds and reverses the transfer", () => {
    const plan = planDisputeRuling({ ...released, ruling: { refundMinor: 4_000, clawbackMinor: 4_000 } });
    expect(plan).toMatchObject({ paymentStatus: "PARTIALLY_REFUNDED", vendorPayMinor: 4_000, platformCostMinor: 0, bookingStatus: "PAYMENT_RELEASED" });
    const full = planDisputeRuling({ ...released, ruling: { refundMinor: 10_000, clawbackMinor: 8_000 } });
    expect(full).toMatchObject({ paymentStatus: "REFUNDED", bookingStatus: "CANCELLED" });
  });

  it("refuses impossible amounts", () => {
    expect(() => planDisputeRuling({ ...released, ruling: { refundMinor: 10_001, clawbackMinor: 0 } })).toThrow();
    expect(() => planDisputeRuling({ ...released, ruling: { refundMinor: 0, clawbackMinor: 8_001 } })).toThrow();
    expect(() => planDisputeRuling({ ...released, ruling: { refundMinor: -1, clawbackMinor: 0 } })).toThrow();
    expect(() => planDisputeRuling({ stage: "NONE", chargeMinor: 0, payoutMinor: 0, ruling: { refundMinor: 1, clawbackMinor: 0 } })).toThrow();
  });

  it("knows where the money is", () => {
    expect(disputeStageOf("AUTHORISED")).toBe("HELD");
    expect(disputeStageOf("CARD_SAVED")).toBe("HELD");
    expect(disputeStageOf("ESCROW_RELEASED")).toBe("RELEASED");
    expect(disputeStageOf("NOT_STARTED")).toBe("NONE");
  });
});
