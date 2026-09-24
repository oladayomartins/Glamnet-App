import { describe, expect, it } from "vitest";
import { decideCommission, settle } from "../settlement";

describe("decideCommission (dual-commission protocol)", () => {
  it("Rule A: a direct link is never commissioned", () => {
    expect(
      decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false }),
    ).toEqual({ rule: "A", firstDiscoveryBooking: false, commissionBps: 0 });
  });

  it("Rule B: a new client from the marketplace is a first discovery booking", () => {
    for (const source of ["MARKETPLACE", "BROADCAST"] as const) {
      expect(decideCommission({ source, hasPriorBooking: false })).toEqual({
        rule: "B",
        firstDiscoveryBooking: true,
        commissionBps: 3_000,
      });
    }
  });

  it("every booking after the first defaults to Rule A", () => {
    expect(
      decideCommission({ source: "MARKETPLACE", hasPriorBooking: true }).rule,
    ).toBe("A");
  });
});

describe("settle", () => {
  // £100 of services + £5 travel + £0.50 trust fee = £105.50, plus a £10 tip.
  const base = {
    totalMinor: 10_550,
    commissionableMinor: 10_000,
    trustFeeMinor: 50,
    tipMinor: 1_000,
  };

  it("Rule A: 0% commission, 2% processing on the charge", () => {
    const result = settle({
      ...base,
      commission: decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false }),
    });
    expect(result.chargeMinor).toBe(11_550);
    expect(result.platformCommissionMinor).toBe(0);
    expect(result.processingFeeMinor).toBe(231);
    expect(result.providerPayoutMinor).toBe(11_550 - 50 - 231);
  });

  it("Rule B: 30% of the work, vendor keeps 70% + travel + 100% of the tip", () => {
    const result = settle({
      ...base,
      commission: decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }),
    });
    expect(result.platformCommissionMinor).toBe(3_000);
    expect(result.processingFeeMinor).toBe(0);
    // 7,000 work + 500 travel + 1,000 tip.
    expect(result.providerPayoutMinor).toBe(8_500);
  });

  it("always balances: payout + platform share = charge", () => {
    for (const source of ["MARKETPLACE", "DIRECT_LINK"] as const) {
      const result = settle({
        ...base,
        commission: decideCommission({ source, hasPriorBooking: false }),
      });
      expect(result.providerPayoutMinor + result.platformRetainedMinor).toBe(
        result.chargeMinor,
      );
    }
  });

  it("ignores a negative tip", () => {
    const result = settle({
      ...base,
      tipMinor: -500,
      commission: decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }),
    });
    expect(result.chargeMinor).toBe(10_550);
  });
});
