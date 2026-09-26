import { describe, expect, it } from "vitest";
import { storefrontSlotsSchema } from "@/lib/api/schemas";

describe("storefrontSlotsSchema date", () => {
  it("reads YYYY-MM-DD as that UK calendar day, at UK midnight", () => {
    // Saturday 26 September 2026 is British Summer Time.
    const { date } = storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "2026-09-26" });
    expect(date.toISOString()).toBe("2026-09-25T23:00:00.000Z");
  });

  it("still accepts a full timestamp", () => {
    const { date } = storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "2026-09-26T09:00:00.000Z" });
    expect(date.toISOString()).toBe("2026-09-26T09:00:00.000Z");
  });

  it("refuses something that is not a date", () => {
    expect(() => storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "Saturday" })).toThrow();
  });
});
