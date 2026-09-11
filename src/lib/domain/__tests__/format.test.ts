import { describe, expect, it } from "vitest";
import {
  describeSurcharge,
  formatCustomerTime,
  formatDuration,
  formatTime,
  toDateInputValue,
} from "@/lib/format";

describe("formatDuration", () => {
  it("renders hours and minutes", () => {
    expect(formatDuration(135)).toBe("2h 15m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45m");
  });
});

describe("describeSurcharge", () => {
  it("renders basis points as a percentage", () => {
    expect(describeSurcharge("PERCENTAGE", 2_500)).toBe("25%");
    expect(describeSurcharge("PERCENTAGE", 1_750)).toBe("17.50%");
  });

  it("renders pence as GBP", () => {
    expect(describeSurcharge("FIXED", 1_500)).toBe("£15.00");
  });
});

describe("toDateInputValue", () => {
  it("zero-pads month and day", () => {
    expect(toDateInputValue(new Date(2026, 3, 1))).toBe("2026-04-01");
    expect(toDateInputValue(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});

describe("the two clocks", () => {
  const evening = new Date(2026, 3, 1, 18, 0);
  const morning = new Date(2026, 3, 1, 9, 5);

  it("gives providers 24-hour time", () => {
    expect(formatTime(evening)).toBe("18:00");
    expect(formatTime(morning)).toBe("09:05");
  });

  it("gives customers 12-hour time", () => {
    expect(formatCustomerTime(evening)).toMatch(/^6:00\s?pm$/i);
    expect(formatCustomerTime(morning)).toMatch(/^9:05\s?am$/i);
  });
});
