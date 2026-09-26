import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bookingBroadcast: { updateMany: vi.fn(), findUnique: vi.fn() },
  booking: { findMany: vi.fn() },
}));

vi.mock("@/lib/server/prisma", () => ({ prisma: db }));

const { declineBroadcast } = await import("@/lib/server/payment-flow");

const now = new Date("2026-09-26T10:00:00Z");

describe("declineBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.booking.findMany.mockResolvedValue([]);
  });

  it("declines an open invitation and checks whether anyone can still accept", async () => {
    db.bookingBroadcast.updateMany.mockResolvedValue({ count: 1 });

    await declineBroadcast("b1", "p1", now);

    expect(db.bookingBroadcast.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "b1", providerId: "p1", status: "PENDING", expiresAt: { gt: now } },
      data: { status: "DECLINED", respondedAt: now },
    });
    // The early-end sweep runs for this booking only, and treats a declined
    // invitation like a lapsed one.
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b1",
          broadcasts: {
            every: { OR: [{ expiresAt: { lt: now } }, { status: { not: "PENDING" } }] },
            some: {},
          },
        }),
      }),
    );
  });

  it("is harmless when declined twice", async () => {
    db.bookingBroadcast.updateMany.mockResolvedValue({ count: 0 });
    db.bookingBroadcast.findUnique.mockResolvedValue({ status: "DECLINED" });

    await expect(declineBroadcast("b1", "p1", now)).resolves.toBeUndefined();
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it("refuses a request that was never offered to this vendor", async () => {
    db.bookingBroadcast.updateMany.mockResolvedValue({ count: 0 });
    db.bookingBroadcast.findUnique.mockResolvedValue(null);

    await expect(declineBroadcast("b1", "p1", now)).rejects.toMatchObject({
      code: "NOT_INVITED",
    });
  });

  it("refuses a request that is no longer open", async () => {
    db.bookingBroadcast.updateMany.mockResolvedValue({ count: 0 });
    db.bookingBroadcast.findUnique.mockResolvedValue({ status: "LOST" });

    await expect(declineBroadcast("b1", "p1", now)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});
