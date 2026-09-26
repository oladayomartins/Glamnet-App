import { describe, expect, it } from "vitest";
import { summariseReputation } from "@/lib/domain/reputation";

describe("summariseReputation", () => {
  it("never shows a rating that no one has given", () => {
    const fresh = summariseReputation(5, 0);
    expect(fresh.rating).toBeNull();
    expect(fresh.badge).toBe("NEW");
    expect(fresh.label).toBe("New on GLAMNET");
    // The specific thing that looked dishonest on the old storefront.
    expect(fresh.label).not.toContain("5.0");
  });

  it("does not call an experienced provider new just because nobody wrote a review", () => {
    const unreviewed = summariseReputation(4.9, 0, 301);
    expect(unreviewed.badge).toBe("UNREVIEWED");
    expect(unreviewed.label).toBe("No reviews yet");
    expect(unreviewed.rating).toBeNull();
  });

  it("always says how many reviews a rating is based on", () => {
    expect(summariseReputation(5, 1).label).toBe("5.0 (1 review)");
    expect(summariseReputation(5, 3).label).toBe("5.0 (3 reviews)");
  });

  it("withholds Top rated until the sample can support it", () => {
    expect(summariseReputation(5, 4).badge).toBe("ESTABLISHED");
    expect(summariseReputation(5, 5).badge).toBe("TOP_RATED");
  });

  it("withholds Top rated from a large but middling score", () => {
    expect(summariseReputation(4.4, 50).badge).toBe("ESTABLISHED");
    expect(summariseReputation(4.8, 50).badge).toBe("TOP_RATED");
  });

  it("rounds to one decimal, and does not round 4.75 up into the badge", () => {
    expect(summariseReputation(4.75, 20).rating).toBe(4.8);
    expect(summariseReputation(4.749, 20).rating).toBe(4.7);
    expect(summariseReputation(4.749, 20).badge).toBe("ESTABLISHED");
  });
});
