import { describe, expect, it } from "vitest";
import { whenLabel, whenOptions } from "@/lib/domain/when-options";
import { uk } from "./uk-clock";

// A Thursday, mid-afternoon, British Summer Time.
const THURSDAY = uk("2026-09-24T15:00");
// Late enough that a UTC-based "today" would already have rolled over, and
// early enough in GMT that a naive local clock would not.
const LATE_NIGHT = uk("2026-11-12T23:30");

describe("whenOptions", () => {
  it("offers Any time first, and does not preselect a day", () => {
    const [first] = whenOptions(THURSDAY);
    expect(first).toEqual({ value: "", label: "Any time" });
  });

  it("names the first two days rather than dating them", () => {
    const labels = whenOptions(THURSDAY).map((option) => option.label);
    expect(labels[1]).toBe("Today");
    expect(labels[2]).toBe("Tomorrow");
    expect(labels[3]).toBe("Sat 26 Sep");
  });

  it("returns the horizon plus the Any time entry", () => {
    expect(whenOptions(THURSDAY)).toHaveLength(15);
    expect(whenOptions(THURSDAY, 3)).toHaveLength(4);
  });

  it("hands the engine the same YYYY-MM-DD it parses", () => {
    const values = whenOptions(THURSDAY, 3).map((option) => option.value);
    expect(values).toEqual(["", "2026-09-24", "2026-09-25", "2026-09-26"]);
    for (const value of values.slice(1)) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("builds days on the UK clock, not the viewer's", () => {
    // 23:30 UK is already tomorrow in UTC+2. "Today" must still be the 12th,
    // because that is the day the availability engine will answer for.
    expect(whenOptions(LATE_NIGHT, 2)[1]).toEqual({
      value: "2026-11-12",
      label: "Today",
    });
  });

  it("advances across a month boundary without repeating a day", () => {
    const values = whenOptions(uk("2026-09-29T10:00"), 5).map((o) => o.value);
    expect(values).toEqual([
      "",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("whenLabel", () => {
  it("reads back a chosen day by its friendly name", () => {
    expect(whenLabel("", THURSDAY)).toBe("Any time");
    expect(whenLabel("2026-09-24", THURSDAY)).toBe("Today");
    expect(whenLabel("2026-09-25", THURSDAY)).toBe("Tomorrow");
  });

  it("builds labels without Intl, so server and browser agree", () => {
    // Node and Chromium ship different ICU data: one rendered "Mon 28 Sept"
    // and the other "Mon, 28 Sept", which React reported as a hydration
    // mismatch. No comma is the cheap way to assert the tables are in use.
    for (const option of whenOptions(THURSDAY)) {
      expect(option.label).not.toContain(",");
    }
  });

  it("shows a day beyond the horizon as itself, never as unfiltered", () => {
    // A stale link or a hand-edited parameter. Saying "Any time" here would
    // claim the page is unfiltered while the results are filtered.
    expect(whenLabel("2027-03-04", THURSDAY)).toBe("4 Mar 2027");
  });

  it("falls back to Any time only when the value is not a date", () => {
    expect(whenLabel("not-a-date", THURSDAY)).toBe("Any time");
  });
});
