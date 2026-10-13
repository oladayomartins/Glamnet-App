import { describe, expect, it } from "vitest";
import { priceBooking } from "../pricing";
import { decideCommission, settle } from "../settlement";
import { evaluatePromo, type PromoRule } from "../promo";
import { lateCancellationFeeMinor, serviceValueMinor } from "../cancellation";

const basket = [
  { id: "s1", name: "Gele Tie", priceMinor: 3_000, durationMinutes: 20, kind: "SERVICE" as const },
  { id: "a1", name: "Pins", priceMinor: 1_000, durationMinutes: 5, kind: "ADDON" as const },
];

describe("vendor discount codes", () => {
  it("come off the services as a line, never more than the services", () => {
    const price = priceBooking({
      basket,
      bookingType: "NORMAL",
      travelFeeMinor: 500,
      emergencyConfig: null,
      trustFeeMinor: 50,
      vendorDiscount: { amountMinor: 400, label: "Discount from Amara (AMARA10)" },
    });
    expect(price.subtotalMinor).toBe(4_000);
    expect(price.vendorDiscountMinor).toBe(400);
    expect(price.totalMinor).toBe(4_000 - 400 + 500 + 50);
    expect(price.lines.find((line) => line.key === "vendor-discount")).toMatchObject({ amountMinor: -400 });

    const capped = priceBooking({
      basket,
      bookingType: "NORMAL",
      travelFeeMinor: 0,
      emergencyConfig: null,
      trustFeeMinor: 0,
      vendorDiscount: { amountMinor: 99_999, label: "x" },
    });
    expect(capped.vendorDiscountMinor).toBe(4_000);
    expect(capped.totalMinor).toBe(0);
  });

  it("are paid for by the vendor, with commission on the discounted price", () => {
    // £40 of services, 10% vendor code, new marketplace client at 30%.
    const s = settle({
      totalMinor: 4_000 - 400 + 50,
      commissionableMinor: 4_000 - 400,
      trustFeeMinor: 50,
      tipMinor: 0,
      commission: decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }),
    });
    expect(s.platformCommissionMinor).toBe(1_080);
    expect(s.providerPayoutMinor).toBe(3_600 - 1_080);
    expect(s.chargeMinor).toBe(3_650);
  });

  it("lower the cancellation fee with the price the client agreed", () => {
    const booking = {
      appointmentStartAt: new Date(),
      bookingCreatedAt: new Date(),
      status: "CONFIRMED",
      serviceLocation: "VENDOR_PREMISES",
      subtotalMinor: 4_000,
      emergencySurchargeMinor: 0,
      otherSurchargesMinor: 0,
      travelFeeMinor: 0,
      totalInvoicePriceMinor: 3_600,
      tipMinor: 0,
      discountMinor: 0,
      vendorDiscountMinor: 400,
    };
    expect(serviceValueMinor(booking)).toBe(3_600);
    expect(lateCancellationFeeMinor(booking)).toBe(1_800);
  });

  it("say whose new clients a first-booking code is for", () => {
    const rule: PromoRule = {
      code: "AMARA10",
      discountType: "PERCENT",
      value: 1_000,
      maxDiscountMinor: 0,
      minSpendMinor: 0,
      firstBookingOnly: true,
      category: "",
      maxRedemptions: 0,
      perCustomerLimit: 1,
      startsAt: new Date("2026-01-01"),
      endsAt: null,
      isActive: true,
      ownerName: "Amara Okafor",
    };
    const ctx = {
      now: new Date("2026-10-10"),
      lines: [{ category: "Hair", priceMinor: 4_000 }],
      totalRedemptions: 0,
      customerRedemptions: 0,
      customerPriorBookings: 1,
      platformShareMinor: Number.MAX_SAFE_INTEGER,
    };
    expect(evaluatePromo(rule, ctx)).toEqual({ ok: false, reason: "This code is for new clients of Amara Okafor." });
    expect(evaluatePromo(rule, { ...ctx, customerPriorBookings: 0 })).toEqual({ ok: true, discountMinor: 400, limitedByShare: false });
  });
});
