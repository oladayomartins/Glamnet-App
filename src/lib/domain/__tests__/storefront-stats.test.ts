import { describe, expect, it } from "vitest";
import { isBot, parseStatPeriod, statDay, summariseStats } from "../storefront-stats";

describe("storefront stats", () => {
  it("files a view under its UK day", () => {
    // 23:30 UTC on 9 Oct is 00:30 on 10 Oct in the UK (BST).
    expect(statDay(new Date("2026-10-09T23:30:00Z")).toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("ignores bots and link previews", () => {
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram")).toBe(false);
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("WhatsApp/2.23")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(parseStatPeriod("7")).toBe("7");
    expect(parseStatPeriod("nope")).toBe("30");
  });

  it("splits views and bookings by source, with conversion and earnings", () => {
    const from = new Date("2026-10-08T00:00:00Z");
    const summary = summariseStats({
      from,
      dayCount: 3,
      views: [
        { day: new Date("2026-10-08T00:00:00Z"), source: "DIRECT_LINK", views: 30 },
        { day: new Date("2026-10-09T00:00:00Z"), source: "DIRECT_LINK", views: 10 },
        { day: new Date("2026-10-09T00:00:00Z"), source: "MARKETPLACE", views: 20 },
        // Outside the window: ignored.
        { day: new Date("2026-10-01T00:00:00Z"), source: "DIRECT_LINK", views: 999 },
      ],
      bookings: [
        { createdAt: new Date("2026-10-08T10:00:00Z"), source: "DIRECT_LINK", status: "PAYMENT_RELEASED", payoutMinor: 4_000 },
        { createdAt: new Date("2026-10-09T10:00:00Z"), source: "DIRECT_LINK", status: "CONFIRMED", payoutMinor: 3_000 },
        { createdAt: new Date("2026-10-10T10:00:00Z"), source: "MARKETPLACE", status: "REVIEWED", payoutMinor: 2_100 },
        { createdAt: new Date("2026-10-10T11:00:00Z"), source: "MARKETPLACE", status: "EXPIRED", payoutMinor: 0 },
        { createdAt: new Date("2026-10-10T12:00:00Z"), source: "BROADCAST", status: "REVIEWED", payoutMinor: 5_000 },
      ],
    });
    expect(summary.days.map((day) => day.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(summary.days[1]).toEqual({ date: "2026-10-09", link: 10, directory: 20, bookings: 1 });
    expect(summary.link).toEqual({ views: 40, bookings: 2, conversionPct: 5, earnedMinor: 4_000 });
    expect(summary.directory).toEqual({ views: 20, bookings: 1, conversionPct: 5, earnedMinor: 2_100 });
    expect(summary.total).toEqual({ views: 60, bookings: 3, conversionPct: 5, earnedMinor: 6_100 });
  });

  it("has no conversion rate without views", () => {
    const summary = summariseStats({ from: new Date("2026-10-08T00:00:00Z"), dayCount: 1, views: [], bookings: [] });
    expect(summary.total.conversionPct).toBeNull();
  });
});
