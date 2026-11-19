import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  provider: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  booking: { findMany: vi.fn(), updateMany: vi.fn() },
  bookingStatusEvent: { create: vi.fn() },
}));

vi.mock("@/lib/server/prisma", () => ({ prisma: db }));

// No STRIPE_SECRET_KEY in tests: the simulated gateway moves no money.
const { mustHoldPayout, heldAmountOf, releaseHeldPayouts, retryHeldPayouts } = await import("@/lib/server/held-payouts");

const amounts = {
  totalInvoicePriceMinor: 6_000,
  tipMinor: 0,
  discountMinor: 0,
  providerPayoutMinor: 5_000,
  cancellationFeeMinor: 0,
  cancellationFeePayoutMinor: 0,
  clawbackMinor: 0,
};

describe("mustHoldPayout", () => {
  it("holds for an unverified vendor even with a bank", () => {
    expect(mustHoldPayout({ isVerified: false, stripeAccountId: "acct_1", payoutsEnabled: true }, "stripe")).toBe(true);
  });

  it("holds for a verified vendor whose bank can't receive yet", () => {
    expect(mustHoldPayout({ isVerified: true, stripeAccountId: "acct_1", payoutsEnabled: false }, "stripe")).toBe(true);
  });

  it("pays a verified vendor with a working bank", () => {
    expect(mustHoldPayout({ isVerified: true, stripeAccountId: "acct_1", payoutsEnabled: true }, "stripe")).toBe(false);
  });
});

describe("heldAmountOf", () => {
  it("is the payout less any clawback, and never negative", () => {
    expect(heldAmountOf(amounts)).toBe(5_000);
    expect(heldAmountOf({ ...amounts, clawbackMinor: 1_500 })).toBe(3_500);
    expect(heldAmountOf({ ...amounts, clawbackMinor: 9_000 })).toBe(0);
  });

  it("uses the vendor's share of a cancellation fee on a fee-only booking", () => {
    expect(heldAmountOf({ ...amounts, cancellationFeeMinor: 2_000, cancellationFeePayoutMinor: 1_600 })).toBe(1_600);
  });
});

describe("releaseHeldPayouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("leaves an unverified vendor's earnings held", async () => {
    db.provider.findUnique.mockResolvedValue({ isVerified: false, stripeAccountId: "", payoutsEnabled: false });
    await expect(releaseHeldPayouts("p1")).resolves.toEqual({ released: 0, totalMinor: 0, failed: 0 });
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it("pays out every held booking not under dispute once verified", async () => {
    db.provider.findUnique.mockResolvedValue({ isVerified: true, stripeAccountId: "", payoutsEnabled: false });
    db.booking.findMany.mockResolvedValue([
      { ...amounts, id: "b1", status: "PAYMENT_RELEASED", paymentIntentId: "pi_1" },
      { ...amounts, id: "b2", status: "PAYMENT_RELEASED", paymentIntentId: "pi_2", clawbackMinor: 1_000 },
    ]);

    await expect(releaseHeldPayouts("p1")).resolves.toEqual({ released: 2, totalMinor: 9_000, failed: 0 });
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: "p1", payoutHeld: true, NOT: { settlementStatus: "DISPUTED" } } }),
    );
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", payoutHeld: true },
      data: { payoutHeld: false, transferId: "sim_tr_b1" },
    });
  });
});

describe("retryHeldPayouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("only looks at verified vendors with payouts held outside a dispute", async () => {
    db.provider.findMany.mockResolvedValue([]);
    await expect(retryHeldPayouts()).resolves.toEqual({ vendors: 0, released: 0, totalMinor: 0, failed: 0 });
    expect(db.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isVerified: true,
          bookings: { some: { payoutHeld: true, NOT: { settlementStatus: "DISPUTED" } } },
        },
      }),
    );
  });

  it("pays each vendor and keeps going when one errors", async () => {
    db.provider.findMany.mockResolvedValue([
      { id: "p1", stripeAccountId: "", payoutsEnabled: false },
      { id: "p2", stripeAccountId: "", payoutsEnabled: false },
    ]);
    db.provider.findUnique
      .mockRejectedValueOnce(new Error("database blip"))
      .mockResolvedValueOnce({ isVerified: true, stripeAccountId: "", payoutsEnabled: false });
    db.booking.findMany.mockResolvedValue([{ ...amounts, id: "b9", status: "PAYMENT_RELEASED", paymentIntentId: "pi_9" }]);

    await expect(retryHeldPayouts()).resolves.toEqual({ vendors: 2, released: 1, totalMinor: 5_000, failed: 1 });
  });
});
