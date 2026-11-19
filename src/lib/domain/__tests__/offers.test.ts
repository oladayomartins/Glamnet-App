import { describe, expect, it } from "vitest";
import {
  canTransitionPriceOffer,
  isPriceOfferExpired,
  isPriceOfferOpen,
  MIN_PRICE_OFFER_BPS,
  platformServiceCutMinor,
  priceOfferExpiresAt,
  priceOfferFloorMinor,
  priceOfferTurn,
  PRICE_OFFER_VALIDITY_HOURS,
  validatePriceOffer,
} from "../offers";
import { formatMoney, priceBooking } from "../pricing";
import type { BasketLine, EmergencyPricingConfig } from "../types";

const NOW = new Date("2026-04-01T08:00:00Z");
/** Four days out — comfortably outside the 12-hour emergency window. */
const APPOINTMENT = new Date("2026-04-05T10:00:00Z");

const basket: BasketLine[] = [
  { id: "updo", name: "Prom Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE" },
  { id: "lash", name: "Lash Lift", priceMinor: 2_000, durationMinutes: 30, kind: "ADDON" },
];
/** The basket lists at £100.00. */
const LISTED = 10_000;

const emergencyConfig: EmergencyPricingConfig = {
  thresholdMinutes: 720,
  surchargeType: "PERCENTAGE",
  surchargeValue: 2_500,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
};

describe("platformServiceCutMinor", () => {
  it("is the platform's share of the listed service work", () => {
    // 70% to the vendor leaves 30% with the platform.
    expect(platformServiceCutMinor(LISTED)).toBe(3_000);
    expect(platformServiceCutMinor(LISTED, 8_000)).toBe(2_000);
  });
});

describe("priceOfferFloorMinor", () => {
  it("never lets the floor fall below the platform's cut", () => {
    // 10% minimum share would be £10, but the platform's cut is £30.
    expect(priceOfferFloorMinor(LISTED, 7_000, 1_000)).toBe(3_000);
  });

  it("uses the minimum-share guard when it is the higher of the two", () => {
    // Default 50% of £100 is £50, above the £30 platform cut.
    expect(priceOfferFloorMinor(LISTED)).toBe(5_000);
    expect(priceOfferFloorMinor(LISTED, 7_000, MIN_PRICE_OFFER_BPS)).toBe(5_000);
  });
});

describe("priceOfferExpiresAt", () => {
  it("uses the validity window when the appointment is far off", () => {
    const expires = priceOfferExpiresAt({
      createdAt: NOW,
      appointmentStartAt: APPOINTMENT,
    });
    expect(expires.getTime()).toBe(
      NOW.getTime() + PRICE_OFFER_VALIDITY_HOURS * 3_600_000,
    );
  });

  it("brings expiry forward to the emergency boundary when that comes first", () => {
    // Appointment 20 hours away: the 12-hour boundary is 8 hours from now,
    // which is earlier than the 24-hour validity window.
    const appointment = new Date(NOW.getTime() + 20 * 3_600_000);
    const expires = priceOfferExpiresAt({
      createdAt: NOW,
      appointmentStartAt: appointment,
    });
    expect(expires.getTime()).toBe(NOW.getTime() + 8 * 3_600_000);
  });

  it("never returns an instant before the offer was made", () => {
    // Appointment already inside the window.
    const appointment = new Date(NOW.getTime() + 2 * 3_600_000);
    expect(
      priceOfferExpiresAt({ createdAt: NOW, appointmentStartAt: appointment }).getTime(),
    ).toBe(NOW.getTime());
  });

  it("honours a non-default threshold", () => {
    const appointment = new Date(NOW.getTime() + 20 * 3_600_000);
    const expires = priceOfferExpiresAt({
      createdAt: NOW,
      appointmentStartAt: appointment,
      thresholdMinutes: 60,
    });
    expect(expires.getTime()).toBe(NOW.getTime() + 19 * 3_600_000);
  });
});

describe("isPriceOfferExpired", () => {
  it("expires on the boundary, not after it", () => {
    expect(isPriceOfferExpired(NOW, NOW)).toBe(true);
    expect(isPriceOfferExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });
});

describe("validatePriceOffer", () => {
  const base = {
    listedSubtotalMinor: LISTED,
    acceptsOffers: true,
    createdAt: NOW,
    appointmentStartAt: APPOINTMENT,
  };

  it("accepts an offer between the floor and the listed price", () => {
    const result = validatePriceOffer({ ...base, proposedSubtotalMinor: 8_000 });
    expect(result.ok).toBe(true);
    expect(result.floorMinor).toBe(5_000);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("refuses when the vendor is not taking offers", () => {
    const result = validatePriceOffer({
      ...base,
      acceptsOffers: false,
      proposedSubtotalMinor: 8_000,
    });
    expect(result).toMatchObject({ ok: false, reason: "NOT_ACCEPTING_OFFERS" });
  });

  it("refuses inside the emergency window", () => {
    const result = validatePriceOffer({
      ...base,
      appointmentStartAt: new Date(NOW.getTime() + 6 * 3_600_000),
      proposedSubtotalMinor: 8_000,
    });
    expect(result).toMatchObject({ ok: false, reason: "INSIDE_EMERGENCY_WINDOW" });
  });

  it("refuses exactly on the emergency threshold", () => {
    const result = validatePriceOffer({
      ...base,
      appointmentStartAt: new Date(NOW.getTime() + 720 * 60_000),
      proposedSubtotalMinor: 8_000,
    });
    expect(result).toMatchObject({ ok: false, reason: "INSIDE_EMERGENCY_WINDOW" });
  });

  it("refuses an offer at or above the listed price", () => {
    expect(
      validatePriceOffer({ ...base, proposedSubtotalMinor: LISTED }),
    ).toMatchObject({ ok: false, reason: "NOT_BELOW_LISTED" });
    expect(
      validatePriceOffer({ ...base, proposedSubtotalMinor: LISTED + 1 }),
    ).toMatchObject({ ok: false, reason: "NOT_BELOW_LISTED" });
  });

  it("refuses an offer below the floor and reports the floor", () => {
    const result = validatePriceOffer({ ...base, proposedSubtotalMinor: 4_999 });
    expect(result).toMatchObject({ ok: false, reason: "BELOW_FLOOR", floorMinor: 5_000 });
  });

  it("refuses non-integer, zero and negative amounts", () => {
    for (const amount of [0, -1, 80.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validatePriceOffer({ ...base, proposedSubtotalMinor: amount }),
      ).toMatchObject({ ok: false, reason: "NOT_AN_AMOUNT" });
    }
  });
});

describe("offer lifecycle", () => {
  it("knows which statuses are still open", () => {
    expect(isPriceOfferOpen("PENDING")).toBe(true);
    expect(isPriceOfferOpen("COUNTERED")).toBe(true);
    for (const status of ["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"] as const) {
      expect(isPriceOfferOpen(status)).toBe(false);
    }
  });

  it("tracks whose turn it is", () => {
    expect(priceOfferTurn("PENDING")).toBe("PROVIDER");
    expect(priceOfferTurn("COUNTERED")).toBe("CUSTOMER");
    expect(priceOfferTurn("ACCEPTED")).toBeNull();
  });

  it("allows the counter-offer loop to repeat", () => {
    expect(canTransitionPriceOffer("PENDING", "COUNTERED", "PROVIDER")).toBe(true);
    expect(canTransitionPriceOffer("COUNTERED", "PENDING", "CUSTOMER")).toBe(true);
  });

  it("refuses a transition by the wrong party", () => {
    // Only the vendor accepts a pending offer; only the customer accepts a counter.
    expect(canTransitionPriceOffer("PENDING", "ACCEPTED", "CUSTOMER")).toBe(false);
    expect(canTransitionPriceOffer("COUNTERED", "ACCEPTED", "PROVIDER")).toBe(false);
  });

  it("refuses any transition out of a closed offer", () => {
    for (const status of ["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"] as const) {
      expect(canTransitionPriceOffer(status, "ACCEPTED", "PROVIDER")).toBe(false);
      expect(canTransitionPriceOffer(status, "PENDING", "CUSTOMER")).toBe(false);
    }
  });
});

describe("priceBooking with an agreed offer", () => {
  const input = {
    basket,
    bookingType: "NORMAL" as const,
    travelFeeMinor: 500,
    emergencyConfig,
  };

  it("leaves an ordinary booking exactly as it was", () => {
    const quote = priceBooking(input, NOW);
    expect(quote.listedSubtotalMinor).toBe(LISTED);
    expect(quote.negotiatedDiscountMinor).toBe(0);
    expect(quote.subtotalMinor).toBe(LISTED);
    // 70% of £100 + £5 travel.
    expect(quote.providerEarningsMinor).toBe(7_500);
    expect(quote.lines.some((l) => l.key === "negotiated")).toBe(false);
  });

  it("charges the agreed price and itemises the discount", () => {
    const quote = priceBooking({ ...input, negotiatedSubtotalMinor: 8_000 }, NOW);
    expect(quote.subtotalMinor).toBe(8_000);
    expect(quote.listedSubtotalMinor).toBe(LISTED);
    expect(quote.negotiatedDiscountMinor).toBe(2_000);
    // £80 services + £5 travel + £0.50 trust fee.
    expect(quote.totalMinor).toBe(8_550);
    const line = quote.lines.find((l) => l.key === "negotiated");
    expect(line?.amountMinor).toBe(-2_000);
  });

  it("makes the vendor, not the platform, pay for the discount", () => {
    const listedQuote = priceBooking(input, NOW);
    const offerQuote = priceBooking({ ...input, negotiatedSubtotalMinor: 8_000 }, NOW);

    const platformAtListed =
      listedQuote.totalMinor - listedQuote.providerEarningsMinor;
    const platformAtOffer =
      offerQuote.totalMinor - offerQuote.providerEarningsMinor;

    // The platform's take is identical; the vendor absorbs the whole £20.
    expect(platformAtOffer).toBe(platformAtListed);
    expect(offerQuote.providerEarningsMinor).toBe(
      listedQuote.providerEarningsMinor - 2_000,
    );
    // £80 - £30 platform cut + £5 travel.
    expect(offerQuote.providerEarningsMinor).toBe(5_500);
  });

  it("keeps the trust fee out of the negotiation", () => {
    const quote = priceBooking({ ...input, negotiatedSubtotalMinor: 8_000 }, NOW);
    expect(quote.trustFeeMinor).toBe(50);
  });

  it("never lets vendor earnings go negative at the floor", () => {
    // Below the platform's cut — refused by validatePriceOffer, clamped here.
    const quote = priceBooking({ ...input, negotiatedSubtotalMinor: 1_000 }, NOW);
    expect(quote.providerEarningsMinor).toBe(500); // travel fee only
  });

  it("ignores a negotiated price that is not a discount", () => {
    const quote = priceBooking({ ...input, negotiatedSubtotalMinor: 12_000 }, NOW);
    expect(quote.subtotalMinor).toBe(LISTED);
    expect(quote.negotiatedDiscountMinor).toBe(0);
  });

  it("charges any emergency surcharge on the agreed price, not the listed one", () => {
    // Defensive: offers lapse at the emergency boundary, so this pairing should
    // not occur in practice. If it ever does, the customer is surcharged on
    // what they actually agreed to pay.
    const quote = priceBooking(
      { ...input, bookingType: "EMERGENCY", negotiatedSubtotalMinor: 8_000 },
      NOW,
    );
    expect(quote.emergencySurchargeMinor).toBe(2_000); // 25% of £80
  });
});

describe("formatMoney in offer copy", () => {
  it("renders the floor the way the customer sees it", () => {
    expect(formatMoney(priceOfferFloorMinor(LISTED))).toBe("£50.00");
  });
});
