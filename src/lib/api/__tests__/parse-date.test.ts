import { describe, expect, it } from "vitest";
import { parseQueryDate } from "../parse-date";

describe("parseQueryDate", () => {
  it("reads YYYY-MM-DD as local midnight", () => {
    const parsed = parseQueryDate("2026-04-01");
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(3);
    expect(parsed!.getDate()).toBe(1);
    expect(parsed!.getHours()).toBe(0);
  });

  it("reads a full ISO timestamp", () => {
    expect(parseQueryDate("2026-04-01T12:30:00.000Z")!.toISOString()).toBe(
      "2026-04-01T12:30:00.000Z",
    );
  });

  it("repairs an offset whose '+' was decoded as a space", () => {
    // `?date=2026-04-01T12:30:00+00:00` arrives with a space in place of the +.
    expect(parseQueryDate("2026-04-01T12:30:00 00:00")!.toISOString()).toBe(
      "2026-04-01T12:30:00.000Z",
    );
  });

  it("repairs a non-UTC offset the same way", () => {
    expect(parseQueryDate("2026-04-01T12:30:00 02:00")!.toISOString()).toBe(
      "2026-04-01T10:30:00.000Z",
    );
  });

  it("returns null for a missing or unreadable value", () => {
    expect(parseQueryDate(null)).toBeNull();
    expect(parseQueryDate("")).toBeNull();
    expect(parseQueryDate("not-a-date")).toBeNull();
  });
});
