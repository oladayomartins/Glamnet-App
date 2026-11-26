import { describe, expect, it } from "vitest";
import { adReportCsv, buildAdReport, dayKey, ukDay } from "../ad-report";

const at = (iso: string) => new Date(iso);

describe("ukDay", () => {
  it("uses the UK date, not the UTC one, in summer", () => {
    expect(dayKey(ukDay(at("2026-07-01T23:30:00Z")))).toBe("2026-07-02");
    expect(dayKey(ukDay(at("2026-12-01T23:30:00Z")))).toBe("2026-12-01");
  });
});

describe("buildAdReport", () => {
  const rows = [
    { day: at("2026-11-02T00:00:00Z"), impressions: 100, clicks: 4 },
    { day: at("2026-11-04T00:00:00Z"), impressions: 50, clicks: 1 },
  ];

  it("covers the whole run of an ended ad, filling quiet days with zeros", () => {
    const report = buildAdReport(
      { startsAt: at("2026-11-01T09:00:00Z"), endsAt: at("2026-11-05T00:00:00Z"), impressions: 150, clicks: 5 },
      rows,
      at("2026-11-20T12:00:00Z"),
    );
    expect(report.from).toBe("2026-11-01");
    expect(report.to).toBe("2026-11-04");
    expect(report.days).toBe(4);
    expect(report.daily.map((row) => row.impressions)).toEqual([0, 100, 0, 50]);
    expect(report.ctr).toBeCloseTo(5 / 150);
  });

  it("runs to today while the ad is still live", () => {
    const report = buildAdReport(
      { startsAt: at("2026-11-01T09:00:00Z"), endsAt: null, impressions: 0, clicks: 0 },
      [],
      at("2026-11-03T12:00:00Z"),
    );
    expect(report.to).toBe("2026-11-03");
    expect(report.days).toBe(3);
    expect(report.ctr).toBeNull();
  });

  it("shows just today for an ad that has not started", () => {
    const report = buildAdReport(
      { startsAt: at("2026-12-01T09:00:00Z"), endsAt: null, impressions: 0, clicks: 0 },
      [],
      at("2026-11-03T12:00:00Z"),
    );
    expect(report.daily).toHaveLength(1);
  });
});

describe("adReportCsv", () => {
  it("has a row per day and a total", () => {
    const report = buildAdReport(
      { startsAt: at("2026-11-01T09:00:00Z"), endsAt: at("2026-11-03T00:00:00Z"), impressions: 10, clicks: 1 },
      [{ day: at("2026-11-01T00:00:00Z"), impressions: 10, clicks: 1 }],
      at("2026-11-20T12:00:00Z"),
    );
    const csv = adReportCsv(report, "=HYPERLINK(evil)");
    expect(csv).toContain("2026-11-01,10,1,10.00");
    expect(csv).toContain("Total,10,1,10.00");
    expect(csv.split("\n")[0]).toBe("Ad: =HYPERLINK(evil)");
    expect(adReportCsv(report, "=x").split("\n")[0]).toBe("Ad: =x");
  });
});
