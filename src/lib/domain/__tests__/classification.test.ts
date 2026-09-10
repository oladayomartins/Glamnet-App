import { describe, expect, it } from "vitest";
import {
  basketDurationMinutes,
  classifyBooking,
  formatNotice,
  noticePeriodMinutes,
  reservedDurationMinutes,
  resolveThresholdMinutes,
} from "../classification";
import type { BasketLine, EmergencyPricingConfig } from "../types";

const at = (iso: string) => new Date(iso);

describe("noticePeriodMinutes", () => {
  it("measures whole minutes from booking to appointment", () => {
    expect(noticePeriodMinutes(at("2026-04-01T08:00:00Z"), at("2026-04-01T18:00:00Z")))
      .toBe(600);
  });

  it("truncates partial minutes toward zero", () => {
    expect(noticePeriodMinutes(at("2026-04-01T08:00:00Z"), at("2026-04-01T08:59:59Z")))
      .toBe(59);
  });

  it("is negative for an appointment in the past", () => {
    expect(noticePeriodMinutes(at("2026-04-01T18:00:00Z"), at("2026-04-01T17:00:00Z")))
      .toBe(-60);
  });
});

describe("classifyBooking (spec §3)", () => {
  it("classifies the spec's 10-hour example as EMERGENCY", () => {
    // Booked 08:00 for 18:00 -> 10 hours notice.
    const notice = noticePeriodMinutes(
      at("2026-04-01T08:00:00Z"),
      at("2026-04-01T18:00:00Z"),
    );
    expect(notice).toBe(600);
    expect(classifyBooking(notice)).toBe("EMERGENCY");
  });

  it("classifies the spec's 13-hour example as NORMAL", () => {
    // Booked 08:00 for 21:00 -> 13 hours notice.
    const notice = noticePeriodMinutes(
      at("2026-04-01T08:00:00Z"),
      at("2026-04-01T21:00:00Z"),
    );
    expect(notice).toBe(780);
    expect(classifyBooking(notice)).toBe("NORMAL");
  });

  it("treats exactly 720 minutes as EMERGENCY (boundary is inclusive)", () => {
    expect(classifyBooking(720)).toBe("EMERGENCY");
  });

  it("treats 721 minutes as NORMAL", () => {
    expect(classifyBooking(721)).toBe("NORMAL");
  });

  it("honours a non-default threshold from admin config", () => {
    expect(classifyBooking(700, 360)).toBe("NORMAL");
    expect(classifyBooking(300, 360)).toBe("EMERGENCY");
  });
});

describe("resolveThresholdMinutes", () => {
  const base: EmergencyPricingConfig = {
    thresholdMinutes: 360,
    surchargeType: "PERCENTAGE",
    surchargeValue: 2_500,
    effectiveFrom: at("2026-01-01T00:00:00Z"),
    isActive: true,
  };

  it("uses the configured threshold when active and effective", () => {
    expect(resolveThresholdMinutes(base, at("2026-04-01T00:00:00Z"))).toBe(360);
  });

  it("falls back to 720 when no config exists", () => {
    expect(resolveThresholdMinutes(null, at("2026-04-01T00:00:00Z"))).toBe(720);
  });

  it("falls back to 720 when the config is inactive", () => {
    expect(
      resolveThresholdMinutes({ ...base, isActive: false }, at("2026-04-01T00:00:00Z")),
    ).toBe(720);
  });

  it("falls back to 720 before the effective date", () => {
    expect(
      resolveThresholdMinutes(base, at("2025-06-01T00:00:00Z")),
    ).toBe(720);
  });
});

describe("basket duration", () => {
  const basket: BasketLine[] = [
    { id: "updo", name: "Prom Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE" },
    { id: "glam", name: "Glam Makeup", priceMinor: 6_500, durationMinutes: 45, kind: "SERVICE" },
  ];

  it("sums the service durations", () => {
    expect(basketDurationMinutes(basket)).toBe(120);
  });

  it("adds the 15-minute transition period to the reserved period", () => {
    expect(reservedDurationMinutes(basket)).toBe(135);
  });
});

describe("formatNotice", () => {
  it("renders hours and zero-padded minutes", () => {
    expect(formatNotice(275)).toBe("4h 35m");
  });

  it("renders minutes alone under an hour", () => {
    expect(formatNotice(42)).toBe("42m");
  });

  it("reports a past appointment as overdue", () => {
    expect(formatNotice(-5)).toBe("overdue");
  });
});
