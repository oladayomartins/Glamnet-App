import { describe, expect, it } from "vitest";
import { DISCOVERY_ROWS, qualifyingRows } from "@/lib/domain/discovery-rows";

const vendors = (count: number) => Array.from({ length: count }, (_, i) => `v${i}`);

describe("qualifyingRows", () => {
  it("shows nothing for an empty marketplace", () => {
    expect(qualifyingRows({})).toEqual([]);
  });

  it("hides a row that cannot meet its minimum rather than rendering it thin", () => {
    // One vendor under "Top rated" is a marketplace pretending to have depth.
    expect(qualifyingRows({ topRated: vendors(2) })).toEqual([]);
    expect(qualifyingRows({ topRated: vendors(3) })).toHaveLength(1);
  });

  it("lets New to GLAMNET appear earlier than the others", () => {
    // A new vendor has no other way to be seen, so this row is the one that
    // should be reachable first.
    const newRow = DISCOVERY_ROWS.find((row) => row.key === "new")!;
    const others = DISCOVERY_ROWS.filter((row) => row.key !== "new");
    for (const row of others) {
      expect(newRow.minimumVendors).toBeLessThan(row.minimumVendors);
    }
  });

  it("keeps catalogue order however the data arrives", () => {
    const rows = qualifyingRows({
      trending: vendors(4),
      new: vendors(4),
      topRated: vendors(4),
    });
    expect(rows.map((row) => row.spec.key)).toEqual(["new", "topRated", "trending"]);
  });

  it("treats a missing key and an empty list the same", () => {
    expect(qualifyingRows({ new: [] })).toEqual(qualifyingRows({}));
  });

  it("does not call a count of recent bookings a trend", () => {
    // "Trending" implies a direction over time; the query is a count.
    const trending = DISCOVERY_ROWS.find((row) => row.key === "trending")!;
    expect(trending.title).toBe("Booked this week");
    expect(trending.title.toLowerCase()).not.toContain("trend");
  });
});
