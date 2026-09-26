import { describe, expect, it } from "vitest";
import {
  describeSurcharge,
  formatCustomerTime,
  formatDuration,
  formatTime,
  toDateInputValue,
} from "@/lib/format";
import { uk } from "./uk-clock";

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
    expect(toDateInputValue(uk("2026-04-01T00:00"))).toBe("2026-04-01");
    expect(toDateInputValue(uk("2026-12-25T12:00"))).toBe("2026-12-25");
  });

  it("gives the UK date, not the UTC one", () => {
    // 00:30 on 1 April in the UK is still 31 March in UTC.
    expect(toDateInputValue(uk("2026-04-01T00:30"))).toBe("2026-04-01");
  });
});

describe("the two clocks", () => {
  // UK wall-clock times; the server that renders them runs in UTC.
  const evening = uk("2026-04-01T18:00");
  const morning = uk("2026-04-01T09:05");

  it("gives vendors 24-hour time", () => {
    expect(formatTime(evening)).toBe("18:00");
    expect(formatTime(morning)).toBe("09:05");
  });

  it("gives customers 12-hour time", () => {
    expect(formatCustomerTime(evening)).toMatch(/^6:00\s?pm$/i);
    expect(formatCustomerTime(morning)).toMatch(/^9:05\s?am$/i);
  });
});
