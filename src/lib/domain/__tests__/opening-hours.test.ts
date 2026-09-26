import { describe, expect, it } from "vitest";
import {
  describeDayHours,
  formatMinuteOfDay,
  openUntil,
  weeklyHours,
} from "@/lib/domain/opening-hours";

const MON = 1;
const SAT = 6;

const windows = [
  { dayOfWeek: MON, startMinute: 9 * 60, endMinute: 17 * 60 },
  // A split Saturday: morning shift, break, evening shift.
  { dayOfWeek: SAT, startMinute: 14 * 60, endMinute: 20 * 60 },
  { dayOfWeek: SAT, startMinute: 8 * 60, endMinute: 12 * 60 },
];

describe("formatMinuteOfDay", () => {
  it("pads to 24-hour clock time", () => {
    expect(formatMinuteOfDay(9 * 60)).toBe("09:00");
    expect(formatMinuteOfDay(19 * 60 + 30)).toBe("19:30");
    expect(formatMinuteOfDay(0)).toBe("00:00");
  });
});

describe("weeklyHours", () => {
  it("lists the week Monday first, the way a UK customer reads it", () => {
    expect(weeklyHours(windows).map((day) => day.name)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("orders a split day's shifts earliest first, however they were entered", () => {
    const saturday = weeklyHours(windows).find((day) => day.name === "Saturday");
    expect(saturday?.windows.map((w) => w.startMinute)).toEqual([
      8 * 60,
      14 * 60,
    ]);
  });

  it("returns a day with no shifts rather than omitting it", () => {
    const sunday = weeklyHours(windows).find((day) => day.name === "Sunday");
    expect(sunday?.windows).toEqual([]);
    expect(describeDayHours(sunday!)).toBe("Closed");
  });
});

describe("describeDayHours", () => {
  it("renders both shifts of a split day", () => {
    const saturday = weeklyHours(windows).find((day) => day.name === "Saturday");
    expect(describeDayHours(saturday!)).toBe("08:00 – 12:00, 14:00 – 20:00");
  });
});

describe("openUntil", () => {
  it("reports the closing time of the shift in progress", () => {
    expect(openUntil(windows, MON, 10 * 60)).toBe("Open until 17:00");
  });

  it("says nothing outside a shift, including during a split day's break", () => {
    expect(openUntil(windows, MON, 18 * 60)).toBeNull();
    expect(openUntil(windows, SAT, 13 * 60)).toBeNull();
  });

  it("is exclusive at the closing minute — 17:00 is closed, not open", () => {
    expect(openUntil(windows, MON, 17 * 60 - 1)).toBe("Open until 17:00");
    expect(openUntil(windows, MON, 17 * 60)).toBeNull();
  });

  it("picks the right shift on a split day", () => {
    expect(openUntil(windows, SAT, 9 * 60)).toBe("Open until 12:00");
    expect(openUntil(windows, SAT, 15 * 60)).toBe("Open until 20:00");
  });
});
