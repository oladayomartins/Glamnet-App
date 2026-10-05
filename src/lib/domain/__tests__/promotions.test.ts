import { describe, expect, it } from "vitest";
import {
  earliestPromotionStart,
  fits,
  promotionArea,
  promotionPrice,
  promotionState,
  rotate,
  slotsFreeNow,
  type Interval,
} from "../promotions";

const DAY = 86_400_000;
const now = new Date("2026-10-05T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * DAY);
const slot = (from: number, to: number): Interval => ({ startsAt: at(from), endsAt: at(to) });

describe("promotionPrice", () => {
  const product = { price7Minor: 1500, price14Minor: 2500, price30Minor: 0 };

  it("prices the packages on sale", () => {
    expect(promotionPrice(product, 7)).toBe(1500);
    expect(promotionPrice(product, 14)).toBe(2500);
  });

  it("refuses a length that is not sold, or not a package", () => {
    expect(promotionPrice(product, 30)).toBeNull();
    expect(promotionPrice(product, 10)).toBeNull();
  });
});

describe("promotionArea", () => {
  it("is the vendor's city for city placements and UK-wide otherwise", () => {
    expect(promotionArea("SEARCH_TOP", " Leeds ")).toBe("Leeds");
    expect(promotionArea("HOME_SPOTLIGHT", "Leeds")).toBe("");
  });
});

describe("fits", () => {
  it("allows up to the slot count at once", () => {
    expect(fits([slot(0, 7), slot(0, 7)], 3, at(0), at(7))).toBe(true);
    expect(fits([slot(0, 7), slot(0, 7), slot(0, 7)], 3, at(0), at(7))).toBe(false);
  });

  it("catches a clash that only starts partway through the new window", () => {
    const taken = [slot(0, 7), slot(0, 30), slot(5, 12)];
    expect(fits(taken, 3, at(0), at(7))).toBe(false);
    expect(fits(taken, 3, at(0), at(5))).toBe(true);
  });

  it("treats windows as ending exclusively", () => {
    expect(fits([slot(0, 7)], 1, at(7), at(14))).toBe(true);
  });
});

describe("earliestPromotionStart", () => {
  it("starts now when a slot is free", () => {
    expect(earliestPromotionStart({ taken: [slot(0, 7)], capacity: 3, days: 7, notBefore: now })).toEqual(now);
  });

  it("queues for the first slot that frees up for the whole run", () => {
    const taken = [slot(-2, 3), slot(0, 10), slot(0, 20)];
    expect(earliestPromotionStart({ taken, capacity: 3, days: 7, notBefore: now })).toEqual(at(3));
  });

  it("skips an opening that is too short for the package", () => {
    // A gap from day 3 to day 5, then full again until day 9.
    const taken = [slot(0, 3), slot(5, 9)];
    expect(earliestPromotionStart({ taken, capacity: 1, days: 7, notBefore: now })).toEqual(at(9));
  });

  it("starts after the vendor's own run when they buy again", () => {
    expect(earliestPromotionStart({ taken: [slot(0, 7)], capacity: 3, days: 7, notBefore: at(7) })).toEqual(at(7));
  });

  it("gives up beyond the queue limit, or with no slots at all", () => {
    expect(earliestPromotionStart({ taken: [slot(0, 120)], capacity: 1, days: 7, notBefore: now })).toBeNull();
    expect(earliestPromotionStart({ taken: [], capacity: 0, days: 7, notBefore: now })).toBeNull();
  });
});

describe("slotsFreeNow", () => {
  it("counts only windows running now", () => {
    expect(slotsFreeNow([slot(-1, 1), slot(2, 9), slot(-9, -1)], 3, now)).toBe(2);
    expect(slotsFreeNow([slot(-1, 1), slot(-1, 1)], 1, now)).toBe(0);
  });
});

describe("promotionState", () => {
  it("reads paid windows against the clock", () => {
    expect(promotionState({ status: "PAID", ...slot(-1, 1) }, now)).toBe("LIVE");
    expect(promotionState({ status: "PAID", ...slot(1, 8) }, now)).toBe("SCHEDULED");
    expect(promotionState({ status: "PAID", ...slot(-8, -1) }, now)).toBe("ENDED");
  });

  it("passes other statuses through", () => {
    expect(promotionState({ status: "PENDING", ...slot(0, 7) }, now)).toBe("PENDING");
    expect(promotionState({ status: "REFUNDED", ...slot(0, 7) }, now)).toBe("REFUNDED");
  });
});

describe("rotate", () => {
  it("returns at most the limit, each item once", () => {
    const picked = rotate(["a", "b", "c", "d"], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it("shuffles with the given source of randomness", () => {
    expect(rotate(["a", "b", "c"], 3, () => 0)).toEqual(["b", "c", "a"]);
  });
});
