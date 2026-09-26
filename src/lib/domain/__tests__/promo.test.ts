import { describe, expect, it } from "vitest";
import { describePromo, evaluatePromo, normalisePromoCode, type PromoContext, type PromoRule } from "../promo";
import { decideCommission, settle } from "../settlement";

const now = new Date("2026-09-24T12:00:00Z");

const rule = (over: Partial<PromoRule> = {}): PromoRule => ({
  code: "WELCOME10",
  discountType: "PERCENT",
  value: 1_000,
  maxDiscountMinor: 0,
  minSpendMinor: 0,
  firstBookingOnly: false,
  category: "",
  maxRedemptions: 0,
  perCustomerLimit: 1,
  startsAt: new Date("2026-09-01T00:00:00Z"),
  endsAt: null,
  isActive: true,
  ...over,
});

const ctx = (over: Partial<PromoContext> = {}): PromoContext => ({
  now,
  lines: [
    { category: "Afro & Textured", priceMinor: 12_000 },
    { category: "Manicures & Pedicures", priceMinor: 3_500 },
  ],
  totalRedemptions: 0,
  customerRedemptions: 0,
  customerPriorBookings: 0,
  platformShareMinor: 10_000,
  ...over,
});

describe("normalisePromoCode", () => {
  it("upper-cases and drops spaces and punctuation", () => {
    expect(normalisePromoCode("  welcome 10! ")).toBe("WELCOME10");
    expect(normalisePromoCode("bridal-25")).toBe("BRIDAL-25");
  });
});

describe("evaluatePromo", () => {
  it("takes a percentage of the services subtotal", () => {
    expect(evaluatePromo(rule(), ctx())).toEqual({ ok: true, discountMinor: 1_550, limitedByShare: false });
  });

  it("gives a fixed amount, never more than the basket", () => {
    expect(evaluatePromo(rule({ discountType: "FIXED", value: 500 }), ctx())).toMatchObject({ ok: true, discountMinor: 500 });
    const tiny = ctx({ lines: [{ category: "X", priceMinor: 300 }] });
    expect(evaluatePromo(rule({ discountType: "FIXED", value: 500 }), tiny)).toMatchObject({ discountMinor: 300 });
  });

  it("respects the per-code cap", () => {
    expect(evaluatePromo(rule({ value: 5_000, maxDiscountMinor: 2_000 }), ctx())).toMatchObject({ discountMinor: 2_000 });
  });

  it("never gives away more than GLAMNET's share, and says so", () => {
    expect(evaluatePromo(rule({ value: 5_000 }), ctx({ platformShareMinor: 400 }))).toEqual({
      ok: true,
      discountMinor: 400,
      limitedByShare: true,
    });
    expect(evaluatePromo(rule(), ctx({ platformShareMinor: 0 }))).toMatchObject({ ok: false });
  });

  it("applies a category code to that category's lines only", () => {
    const nails = rule({ category: "Manicures & Pedicures" });
    expect(evaluatePromo(nails, ctx())).toMatchObject({ discountMinor: 350 });
    const noNails = ctx({ lines: [{ category: "Afro & Textured", priceMinor: 12_000 }] });
    expect(evaluatePromo(nails, noNails)).toEqual({ ok: false, reason: "This code only applies to Manicures & Pedicures services." });
  });

  it("refuses with a reason the customer can act on", () => {
    const reasons = [
      [rule({ isActive: false }), ctx(), "no longer active"],
      [rule({ startsAt: new Date("2026-10-01T00:00:00Z") }), ctx(), "isn't active yet"],
      [rule({ endsAt: new Date("2026-09-24T12:00:00Z") }), ctx(), "expired"],
      [rule({ maxRedemptions: 10 }), ctx({ totalRedemptions: 10 }), "fully used"],
      [rule(), ctx({ customerRedemptions: 1 }), "already used"],
      [rule({ firstBookingOnly: true }), ctx({ customerPriorBookings: 2 }), "first GLAMNET booking"],
      [rule({ minSpendMinor: 20_000 }), ctx(), "Spend £200 or more"],
    ] as const;
    for (const [r, c, text] of reasons) {
      const outcome = evaluatePromo(r, c);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toContain(text);
    }
  });

  it("allows unlimited use when the limits are zero", () => {
    expect(evaluatePromo(rule({ perCustomerLimit: 0 }), ctx({ customerRedemptions: 9, totalRedemptions: 999 })).ok).toBe(true);
  });
});

describe("describePromo", () => {
  it("reads naturally", () => {
    expect(describePromo({ discountType: "PERCENT", value: 1_500, maxDiscountMinor: 0 })).toBe("15% off");
    expect(describePromo({ discountType: "PERCENT", value: 1_000, maxDiscountMinor: 2_000 })).toBe("10% off (up to £20)");
    expect(describePromo({ discountType: "FIXED", value: 750, maxDiscountMinor: 0 })).toBe("£7.50 off");
  });
});

describe("settle with a GLAMNET-funded discount", () => {
  const base = { totalMinor: 12_050, commissionableMinor: 12_000, trustFeeMinor: 50, tipMinor: 0 };

  it("leaves the vendor's payout exactly as it was", () => {
    const rule = decideCommission({ source: "MARKETPLACE", hasPriorBooking: false });
    const without = settle({ ...base, commission: rule });
    const withCode = settle({ ...base, commission: rule, discountMinor: 1_200 });
    expect(withCode.providerPayoutMinor).toBe(without.providerPayoutMinor);
    expect(withCode.chargeMinor).toBe(without.chargeMinor - 1_200);
    expect(withCode.platformRetainedMinor).toBe(without.platformRetainedMinor - 1_200);
  });

  it("clamps the discount to the platform's share, so the payout never exceeds the charge", () => {
    const rule = decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false });
    const result = settle({ ...base, commission: rule, discountMinor: 5_000 });
    // Rule A: GLAMNET keeps only the trust fee and the 2% card fee.
    expect(result.discountMinor).toBe(50 + 241);
    expect(result.providerPayoutMinor).toBeLessThanOrEqual(result.chargeMinor);
    expect(result.platformRetainedMinor).toBe(0);
  });

  it("keeps tips whole", () => {
    const rule = decideCommission({ source: "MARKETPLACE", hasPriorBooking: false });
    const result = settle({ ...base, tipMinor: 1_000, commission: rule, discountMinor: 500 });
    expect(result.chargeMinor).toBe(12_050 + 1_000 - 500);
  });
});
