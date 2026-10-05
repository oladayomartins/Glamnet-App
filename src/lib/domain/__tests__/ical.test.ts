import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, icsDate } from "../ical";

describe("ical", () => {
  it("writes UTC timestamps", () => {
    expect(icsDate(new Date("2026-10-07T09:00:00.000Z"))).toBe("20261007T090000Z");
  });

  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeText("Gele, wrap; tie\\knot\nline 2")).toBe("Gele\\, wrap\\; tie\\\\knot\\nline 2");
  });

  it("folds long lines at 75 bytes without splitting a character", () => {
    const line = `DESCRIPTION:${"é".repeat(60)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.map((part, at) => (at === 0 ? part : part.slice(1))).join("")).toBe(line);
  });

  it("builds a calendar with one event per booking", () => {
    const ics = buildCalendar({
      name: "GLAMNET — Amara",
      now: new Date("2026-10-05T00:00:00Z"),
      events: [
        {
          uid: "booking-b1@glamnet",
          start: new Date("2026-10-07T09:00:00Z"),
          end: new Date("2026-10-07T09:20:00Z"),
          summary: "Gele Tie — Jade",
          location: "14 Ecclesall Road, S11 8HW",
          sequence: 2,
          status: "TENTATIVE",
        },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nUID:booking-b1@glamnet\r\n");
    expect(ics).toContain("\r\nDTSTART:20261007T090000Z\r\nDTEND:20261007T092000Z\r\n");
    expect(ics).toContain("\r\nSEQUENCE:2\r\n");
    expect(ics).toContain("\r\nSTATUS:TENTATIVE\r\n");
    expect(ics).toContain("\r\nLOCATION:14 Ecclesall Road\\, S11 8HW\r\n");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
