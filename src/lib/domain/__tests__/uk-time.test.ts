import { describe, expect, it } from "vitest";
import {
  ukAddDays,
  ukDateString,
  ukOffsetMinutes,
  ukParts,
  ukStartOfDay,
  ukWallClock,
} from "@/lib/domain/uk-time";
import {
  addDays,
  buildDayGrid,
  startOfLocalDay,
  startOfWeek,
  summariseDays,
  withinWorkingHours,
  type ProviderSchedule,
} from "@/lib/domain/availability";
import { parseQueryDate } from "@/lib/api/parse-date";

// These pass under any TZ; `TZ=UTC npx vitest run` is how production runs.
// 2026: clocks go back at 02:00 BST on Sunday 25 October.
// 2027: clocks go forward at 01:00 GMT on Sunday 28 March.

const nineToSix: ProviderSchedule = {
  providerId: "p1",
  workingWindows: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1080 })),
  reservations: [],
  blocks: [],
};

describe("ukOffsetMinutes", () => {
  it("is 60 in summer and 0 in winter", () => {
    expect(ukOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(60);
    expect(ukOffsetMinutes(new Date("2026-12-01T12:00:00Z"))).toBe(0);
  });

  it("changes at 01:00 UTC on each clocks-change Sunday", () => {
    expect(ukOffsetMinutes(new Date("2026-10-25T00:59:00Z"))).toBe(60);
    expect(ukOffsetMinutes(new Date("2026-10-25T01:00:00Z"))).toBe(0);
    expect(ukOffsetMinutes(new Date("2027-03-28T00:59:00Z"))).toBe(0);
    expect(ukOffsetMinutes(new Date("2027-03-28T01:00:00Z"))).toBe(60);
  });
});

describe("ukWallClock", () => {
  it("finds the instant a UK clock reads a time", () => {
    expect(ukWallClock(2026, 9, 26, 9 * 60).toISOString()).toBe("2026-09-26T08:00:00.000Z");
    expect(ukWallClock(2026, 12, 1, 9 * 60).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("gets both clocks-change days right", () => {
    expect(ukWallClock(2026, 10, 25).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(ukWallClock(2026, 10, 25, 9 * 60).toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(ukWallClock(2027, 3, 28).toISOString()).toBe("2027-03-28T00:00:00.000Z");
    expect(ukWallClock(2027, 3, 28, 9 * 60).toISOString()).toBe("2027-03-28T08:00:00.000Z");
  });

  it("moves a time in the missing spring hour forward, as a clock does", () => {
    // 01:30 doesn't exist on 28 March 2027; it reads 02:30 BST.
    const at = ukWallClock(2027, 3, 28, 90);
    expect(at.toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(ukParts(at).hour).toBe(2);
  });

  it("lets the day run over into the next month", () => {
    expect(ukDateString(ukWallClock(2026, 9, 31))).toBe("2026-10-01");
  });
});

describe("UK days", () => {
  it("starts the day at UK midnight, not UTC midnight", () => {
    // 00:30 BST on 26 September is 23:30 UTC on the 25th: still the 26th.
    const lateNight = new Date("2026-09-25T23:30:00Z");
    expect(ukDateString(lateNight)).toBe("2026-09-26");
    expect(ukStartOfDay(lateNight).toISOString()).toBe("2026-09-25T23:00:00.000Z");
    expect(startOfLocalDay(lateNight).toISOString()).toBe("2026-09-25T23:00:00.000Z");
  });

  it("adds days by the calendar, across a clocks change", () => {
    const saturdayNine = ukWallClock(2026, 10, 24, 540);
    const sundayNine = ukAddDays(saturdayNine, 1);
    expect(sundayNine.toISOString()).toBe("2026-10-25T09:00:00.000Z");
    // 25 hours later in real time, 09:00 on the clock both days.
    expect((sundayNine.getTime() - saturdayNine.getTime()) / 3_600_000).toBe(25);
    expect(addDays(ukWallClock(2027, 3, 27), 1).toISOString()).toBe("2027-03-28T00:00:00.000Z");
  });

  it("starts the week on the UK Monday", () => {
    expect(ukDateString(startOfWeek(new Date("2026-09-27T23:30:00Z")))).toBe("2026-09-28");
    expect(ukDateString(startOfWeek(new Date("2026-09-27T12:00:00Z")))).toBe("2026-09-21");
  });

  it("reads a calendar-day query as UK midnight", () => {
    expect(parseQueryDate("2026-10-25")!.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(parseQueryDate("2026-10-26")!.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("working hours in UK time", () => {
  it("offers a 09:00–18:00 vendor from 09:00 UK time in summer", () => {
    const grid = buildDayGrid(ukWallClock(2026, 9, 28), 60, [nineToSix], new Date(0));
    expect(grid[0].startAt.toISOString()).toBe("2026-09-28T08:00:00.000Z");
    // 60 minutes + the 15-minute transition must finish by 18:00.
    expect(grid.at(-1)!.startAt.toISOString()).toBe("2026-09-28T15:45:00.000Z");
  });

  it("keeps 09:00 at 09:00 on the day the clocks go back", () => {
    const grid = buildDayGrid(ukWallClock(2026, 10, 25), 60, [nineToSix], new Date(0));
    expect(grid[0].startAt.toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(ukParts(grid[0].startAt).hour).toBe(9);
    expect(grid.length).toBe((18 * 60 - 9 * 60 - 75) / 15 + 1);
  });

  it("keeps 09:00 at 09:00 on the day the clocks go forward", () => {
    const grid = buildDayGrid(ukWallClock(2027, 3, 28), 60, [nineToSix], new Date(0));
    expect(grid[0].startAt.toISOString()).toBe("2027-03-28T08:00:00.000Z");
    expect(grid.length).toBe((18 * 60 - 9 * 60 - 75) / 15 + 1);
  });

  it("uses the UK weekday, not the UTC one", () => {
    const saturdaysOnly = [{ dayOfWeek: 6, startMinute: 0, endMinute: 120 }];
    // 00:30–01:30 BST on Saturday 26 September is still Friday in UTC.
    const window = { startAt: new Date("2026-09-25T23:30:00Z"), endAt: new Date("2026-09-26T00:30:00Z") };
    expect(withinWorkingHours(window, saturdaysOnly)).toBe(true);
  });

  it("summarises days across a clocks change with the right weekdays and times", () => {
    const days = summariseDays(ukWallClock(2026, 10, 24), 3, 60, nineToSix, new Date(0));
    expect(days.map((day) => ukDateString(day.date))).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(days.map((day) => ukParts(day.firstStartAt!).hour)).toEqual([9, 9, 9]);
  });
});
