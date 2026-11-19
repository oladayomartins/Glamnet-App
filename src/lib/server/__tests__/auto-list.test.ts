import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  provider: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/server/prisma", () => ({ prisma: db }));

const { autoListIfReady } = await import("@/lib/server/provider-portal");

const basicsDone = {
  name: "Folly K Hair",
  slug: "follyk",
  workspaceType: "MOBILE",
  workspaceSector: "SE15",
  workspaceAddress: "",
  _count: { services: 2, availability: 5 },
};

describe("autoListIfReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.provider.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lists a pending vendor as soon as the basics are done", async () => {
    db.provider.findUnique.mockResolvedValue({ onboardedAt: null, approvalStatus: "PENDING" });
    db.provider.findUniqueOrThrow.mockResolvedValue(basicsDone);

    await expect(autoListIfReady("p1")).resolves.toBe(true);
    expect(db.provider.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", onboardedAt: null, approvalStatus: "PENDING" },
      data: { onboardedAt: expect.any(Date), isAcceptingWork: true },
    });
  });

  it("waits while a basic is missing", async () => {
    db.provider.findUnique.mockResolvedValue({ onboardedAt: null, approvalStatus: "PENDING" });
    db.provider.findUniqueOrThrow.mockResolvedValue({ ...basicsDone, _count: { services: 2, availability: 0 } });

    await expect(autoListIfReady("p1")).resolves.toBe(false);
    expect(db.provider.updateMany).not.toHaveBeenCalled();
  });

  it("leaves live, rejected and suspended vendors alone", async () => {
    for (const state of [
      { onboardedAt: new Date(), approvalStatus: "PENDING" },
      { onboardedAt: null, approvalStatus: "REJECTED" },
      { onboardedAt: null, approvalStatus: "SUSPENDED" },
    ]) {
      db.provider.findUnique.mockResolvedValueOnce(state);
      await expect(autoListIfReady("p1")).resolves.toBe(false);
    }
    expect(db.provider.updateMany).not.toHaveBeenCalled();
  });
});
