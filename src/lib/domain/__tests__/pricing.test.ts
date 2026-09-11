import { describe, expect, it } from "vitest";
import {
  applyBps,
  emergencySurchargeMinor,
  formatMoney,
  priceBooking,
} from "../pricing";
import type { BasketLine, EmergencyPricingConfig } from "../types";

const NOW = new Date("2026-04-01T08:00:00Z");

const basket: BasketLine[] = [
  { id: "updo", name: "Prom Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE" },
  { id: "lash", name: "Lash Lift", priceMinor: 2_000, durationMinutes: 30, kind: "ADDON" },
];

const percentageConfig: EmergencyPricingConfig = {
  thresholdMinutes: 720,
  surchargeType: "PERCENTAGE",
  surchargeValue: 2_500, // 25%
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
};

const fixedConfig: EmergencyPricingConfig = {
  ...percentageConfig,
  surchargeType: "FIXED",
  surchargeValue: 1_500, // £15.00
};

describe("applyBps", () => {
  it("applies a basis-point rate with half-up rounding", () => {
    expect(applyBps(10_000, 2_500)).toBe(2_500);
    expect(applyBps(333, 2_500)).toBe(83); // 83.25 -> 83
    expect(applyBps(334, 2_500)).toBe(84); // 83.5 -> 84
  });
});

describe("emergencySurchargeMinor", () => {
  it("charges a percentage of the service subtotal", () => {
    expect(emergencySurchargeMinor(10_000, percentageConfig, NOW)).toBe(2_500);
  });

  it("charges a flat amount when configured as FIXED", () => {
    expect(emergencySurchargeMinor(10_000, fixedConfig, NOW)).toBe(1_500);
  });

  it("is zero with no config", () => {
    expect(emergencySurchargeMinor(10_000, null, NOW)).toBe(0);
  });

  it("is zero when the config is inactive", () => {
    expect(
      emergencySurchargeMinor(10_000, { ...percentageConfig, isActive: false }, NOW),
    ).toBe(0);
  });

  it("is zero before the config's effective date", () => {
    expect(
      emergencySurchargeMinor(
        10_000,
        { ...percentageConfig, effectiveFrom: new Date("2026-12-01T00:00:00Z") },
        NOW,
      ),
    ).toBe(0);
  });
});

describe("priceBooking (spec §5)", () => {
  it("prices a NORMAL booking with no emergency surcharge", () => {
    const price = priceBooking(
      {
        basket,
        bookingType: "NORMAL",
        travelFeeMinor: 500,
        emergencyConfig: percentageConfig,
      },
      NOW,
    );

    expect(price.subtotalMinor).toBe(10_000);
    expect(price.emergencySurchargeMinor).toBe(0);
    expect(price.trustFeeMinor).toBe(50);
    // 10000 services + 500 travel + 0 surcharge + 50 trust fee
    expect(price.totalMinor).toBe(10_550);
    expect(price.lines.some((line) => line.key === "emergency")).toBe(false);
  });

  it("adds the configured surcharge to an EMERGENCY booking", () => {
    const price = priceBooking(
      {
        basket,
        bookingType: "EMERGENCY",
        travelFeeMinor: 500,
        emergencyConfig: percentageConfig,
      },
      NOW,
    );

    expect(price.emergencySurchargeMinor).toBe(2_500);
    // 10000 + 500 + 2500 + 50
    expect(price.totalMinor).toBe(13_050);

    const line = price.lines.find((entry) => entry.key === "emergency");
    expect(line?.emphasis).toBe("emergency");
    expect(line?.amountMinor).toBe(2_500);
  });

  it("always applies the £0.50 trust fee", () => {
    for (const bookingType of ["NORMAL", "EMERGENCY"] as const) {
      const price = priceBooking(
        { basket, bookingType, travelFeeMinor: 0, emergencyConfig: percentageConfig },
        NOW,
      );
      expect(price.trustFeeMinor).toBe(50);
    }
  });

  it("includes other applicable surcharges on both classifications", () => {
    const price = priceBooking(
      {
        basket,
        bookingType: "NORMAL",
        travelFeeMinor: 500,
        otherSurcharges: [
          { key: "bank-holiday", label: "Bank holiday", amountMinor: 750 },
        ],
        emergencyConfig: percentageConfig,
      },
      NOW,
    );

    expect(price.otherSurchargesMinor).toBe(750);
    expect(price.totalMinor).toBe(11_300);
  });

  it("gives the vendor a share of the surge on top of their base earnings", () => {
    const normal = priceBooking(
      { basket, bookingType: "NORMAL", travelFeeMinor: 500, emergencyConfig: percentageConfig },
      NOW,
    );
    const emergency = priceBooking(
      { basket, bookingType: "EMERGENCY", travelFeeMinor: 500, emergencyConfig: percentageConfig },
      NOW,
    );

    // 70% of 10000 + 500 travel
    expect(normal.providerEarningsMinor).toBe(7_500);
    expect(normal.providerEmergencyEarningsMinor).toBe(0);

    // ...plus 70% of the 2500 surcharge
    expect(emergency.providerEmergencyEarningsMinor).toBe(1_750);
    expect(emergency.providerEarningsMinor).toBe(9_250);
  });

  it("never shares the trust fee with the vendor", () => {
    const price = priceBooking(
      {
        basket: [],
        bookingType: "NORMAL",
        travelFeeMinor: 0,
        emergencyConfig: null,
      },
      NOW,
    );
    expect(price.totalMinor).toBe(50);
    expect(price.providerEarningsMinor).toBe(0);
  });

  it("itemises every component so checkout can show it before payment", () => {
    const price = priceBooking(
      { basket, bookingType: "EMERGENCY", travelFeeMinor: 500, emergencyConfig: fixedConfig },
      NOW,
    );
    const summed = price.lines.reduce((total, line) => total + line.amountMinor, 0);
    expect(summed).toBe(price.totalMinor);
  });
});

describe("formatMoney", () => {
  it("formats pence as GBP", () => {
    expect(formatMoney(12_550)).toBe("£125.50");
    expect(formatMoney(50)).toBe("£0.50");
    expect(formatMoney(0)).toBe("£0.00");
  });
});
