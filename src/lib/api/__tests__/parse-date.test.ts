import { describe, expect, it } from "vitest";
import { parseQueryDate } from "../parse-date";

describe("parseQueryDate", () => {
  it("reads YYYY-MM-DD as UK midnight, whatever the server's zone", () => {
    // 1 April is British Summer Time: UK midnight is 23:00 UTC the day before.
    expect(parseQueryDate("2026-04-01")!.toISOString()).toBe("2026-03-31T23:00:00.000Z");
    // In winter the UK is on GMT.
    expect(parseQueryDate("2026-01-15")!.toISOString()).toBe("2026-01-15T00:00:00.000Z");
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
