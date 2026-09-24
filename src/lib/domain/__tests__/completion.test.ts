import { describe, expect, it } from "vitest";
import {
  canDispute,
  disputeWindowClosesAt,
  effectiveSettlementStatus,
  formatPin,
  isWellFormedPin,
  pinMatches,
} from "../completion";

describe("completion PIN", () => {
  it("is always four digits", () => {
    expect(formatPin(7)).toBe("0007");
    expect(formatPin(9_999)).toBe("9999");
    expect(formatPin(12_345)).toBe("2345");
    expect(isWellFormedPin(formatPin(0))).toBe(true);
  });

  it("matches only the exact code", () => {
    expect(pinMatches("0421", "0421")).toBe(true);
    expect(pinMatches("0421", "0412")).toBe(false);
    expect(pinMatches("0421", "421")).toBe(false);
    expect(pinMatches("", "")).toBe(false);
  });
});

describe("24-hour dispute lockout", () => {
  const releasedAt = new Date("2026-09-01T12:00:00Z");
  const booking = {
    escrowReleasedAt: releasedAt,
    disputeWindowClosesAt: disputeWindowClosesAt(releasedAt),
    settlementStatus: "OPEN",
  };

  it("closes exactly 24 hours after release", () => {
    expect(booking.disputeWindowClosesAt.toISOString()).toBe(
      "2026-09-02T12:00:00.000Z",
    );
  });

  it("allows a dispute inside the window and not a second after", () => {
    expect(canDispute(booking, new Date("2026-09-02T11:59:59Z"))).toBe(true);
    expect(canDispute(booking, new Date("2026-09-02T12:00:00Z"))).toBe(false);
  });

  it("is closed_uncontestable once the window passes, even before the sweep", () => {
    expect(
      effectiveSettlementStatus(booking, new Date("2026-09-03T00:00:00Z")),
    ).toBe("CLOSED_UNCONTESTABLE");
    expect(effectiveSettlementStatus(booking, releasedAt)).toBe("OPEN");
  });

  it("never offers a dispute before release or after one was filed", () => {
    expect(
      canDispute(
        { escrowReleasedAt: null, disputeWindowClosesAt: null, settlementStatus: "OPEN" },
        releasedAt,
      ),
    ).toBe(false);
    expect(canDispute({ ...booking, settlementStatus: "DISPUTED" }, releasedAt)).toBe(
      false,
    );
  });
});
