import { describe, expect, it } from "vitest";
import { uk, ukAt } from "@/lib/domain/__tests__/uk-clock";
import { compareOffers, earliestStart } from "@/lib/server/offers";
import type { ProviderSchedule, WorkingWindow } from "@/lib/domain/availability";

const local = uk;

const ALL_WEEK: WorkingWindow[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

const schedule = (overrides: Partial<ProviderSchedule> = {}): ProviderSchedule => ({
  providerId: "p1",
  workingWindows: ALL_WEEK,
  reservations: [],
  blocks: [],
  ...overrides,
});

describe("earliestStart", () => {
  it("offers the start of the working day when nothing is booked", () => {
    const start = earliestStart(schedule(), 60, local("2026-04-01T07:00:00"));
    expect(ukAt(start!).hour).toBe(9);
  });

  it("never offers a time already in the past", () => {
    const now = local("2026-04-01T13:20:00");
    const start = earliestStart(schedule(), 60, now);
    expect(start!.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("respects the transition period, not just the appointment", () => {
    // Booked 09:00–17:00 inclusive of transition. A 60-minute service needs
    // 75 minutes, so 17:00 does not fit before 18:00 but 17:00 + 75 would
    // overrun — the first legal start is tomorrow.
    const busy = schedule({
      reservations: [
        {
          startAt: local("2026-04-01T09:00:00"),
          endAt: local("2026-04-01T17:00:00"),
        },
      ],
    });

    const start = earliestStart(busy, 60, local("2026-04-01T08:00:00"));
    expect(ukAt(start!).day).toBe(2);
    expect(ukAt(start!).hour).toBe(9);
  });

  it("skips a blocked day entirely", () => {
    const off = schedule({
      blocks: [
        {
          startAt: local("2026-04-01T00:00:00"),
          endAt: local("2026-04-02T00:00:00"),
        },
      ],
    });

    expect(ukAt(earliestStart(off, 60, local("2026-04-01T08:00:00"))!).day).toBe(2);
  });

  it("gives up rather than reaching past the horizon", () => {
    // Not a working day anywhere in the week: there is no answer to find, and
    // an offer without a real start must not be shown at all.
    const never = schedule({ workingWindows: [] });
    expect(earliestStart(never, 60, local("2026-04-01T08:00:00"))).toBeNull();
  });
});

describe("compareOffers", () => {
  const offer = (iso: string, rating: number, completed = 0) => ({
    startAt: local(iso),
    rating,
    completedBookings: completed,
  });

  it("puts the soonest first, whatever the rating", () => {
    const sooner = offer("2026-04-01T10:00:00", 3.9);
    const better = offer("2026-04-03T10:00:00", 5);

    expect([better, sooner].sort(compareOffers)[0]).toBe(sooner);
  });

  it("breaks a tie on rating, then on completed work", () => {
    const a = offer("2026-04-01T10:00:00", 4.5, 2);
    const b = offer("2026-04-01T10:00:00", 4.9, 0);
    const c = offer("2026-04-01T10:00:00", 4.5, 9);

    expect([a, b, c].sort(compareOffers)).toEqual([b, c, a]);
  });
});
