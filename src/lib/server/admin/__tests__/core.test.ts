import { describe, expect, it, vi } from "vitest";

vi.mock("../../prisma", () => ({ prisma: {} }));

import { AdminError, isLive, safeLink, scheduleOf } from "../core";
import { resolveRange } from "../ranges";

const at = (iso: string) => new Date(iso);
const now = at("2026-09-24T12:00:00Z");

describe("safeLink", () => {
  it("keeps same-site paths and http(s) URLs", () => {
    expect(safeLink("/sheffield/salons?hub=nails")).toBe("/sheffield/salons?hub=nails");
    expect(safeLink(" https://example.com/offer ")).toBe("https://example.com/offer");
    expect(safeLink("")).toBe("");
  });

  it("refuses protocol-relative and script links", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "javascript:alert(1)", "data:text/html,x", "evil.example"]) {
      expect(() => safeLink(bad)).toThrow(AdminError);
    }
  });
});

describe("campaign and ad schedules", () => {
  const base = { isActive: true, startsAt: at("2026-09-01T00:00:00Z"), endsAt: null };

  it("is live between its dates while active", () => {
    expect(isLive(base, now)).toBe(true);
    expect(scheduleOf(base, now)).toBe("LIVE");
  });

  it("is scheduled before it starts, paused when switched off, ended after it ends", () => {
    expect(scheduleOf({ ...base, startsAt: at("2026-10-01T00:00:00Z") }, now)).toBe("SCHEDULED");
    expect(scheduleOf({ ...base, isActive: false }, now)).toBe("PAUSED");
    expect(scheduleOf({ ...base, endsAt: at("2026-09-20T00:00:00Z") }, now)).toBe("ENDED");
    expect(isLive({ ...base, endsAt: at("2026-09-24T12:00:00Z") }, now)).toBe(false);
  });

  it("reports ended even if it was paused", () => {
    expect(scheduleOf({ isActive: false, startsAt: base.startsAt, endsAt: at("2026-09-02T00:00:00Z") }, now)).toBe("ENDED");
  });
});

describe("finance ranges", () => {
  it("defaults to this calendar month", () => {
    const range = resolveRange(undefined, now);
    expect(range.key).toBe("month");
    expect(range.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("gives last month as a closed calendar month, including across a year boundary", () => {
    const range = resolveRange("last_month", at("2026-01-15T00:00:00Z"));
    expect(range.from.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("ignores an unknown range", () => {
    expect(resolveRange("forever", now).key).toBe("month");
  });
});
