import { describe, expect, it } from "vitest";
import { storefrontSlotsSchema } from "@/lib/api/schemas";

describe("storefrontSlotsSchema date", () => {
  it("reads YYYY-MM-DD as that calendar day, at local midnight", () => {
    const { date } = storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "2026-09-26" });
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 8, 26, 0]);
  });

  it("still accepts a full timestamp", () => {
    const { date } = storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "2026-09-26T09:00:00.000Z" });
    expect(date.toISOString()).toBe("2026-09-26T09:00:00.000Z");
  });

  it("refuses something that is not a date", () => {
    expect(() => storefrontSlotsSchema.parse({ serviceIds: ["s1"], date: "Saturday" })).toThrow();
  });
});
