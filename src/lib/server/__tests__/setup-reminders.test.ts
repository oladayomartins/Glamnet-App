import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  provider: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const push = vi.hoisted(() => ({ pushToUsers: vi.fn() }));
const held = vi.hoisted(() => ({ heldPayoutSummary: vi.fn() }));

vi.mock("@/lib/server/prisma", () => ({ prisma: db }));
vi.mock("@/lib/server/email", () => mail);
vi.mock("@/lib/server/push", () => push);
vi.mock("@/lib/server/held-payouts", () => held);

const { sendSetupReminders } = await import("@/lib/server/setup-reminders");
const { vendorSetupReminderEmail } = await import("@/lib/email/templates");

const now = new Date("2026-11-20T03:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

// Live with the basics (45%), nothing else done.
const liveVendor = {
  id: "p1",
  appUserId: "u1",
  name: "Folly K Hair",
  email: "folly@example.com",
  avatarUrl: "",
  slug: "follykhair",
  bio: "",
  workspaceType: "MOBILE",
  workspaceSector: "S1",
  workspaceAddress: "",
  payoutsEnabled: false,
  approvalStatus: "PENDING",
  createdAt: daysAgo(20),
  onboardedAt: daysAgo(3),
  setupReminderSentAt: null,
  setupRemindersSent: 0,
  _count: { services: 2, availability: 4, lookbook: 0, documents: 0 },
};

describe("sendSetupReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.provider.updateMany.mockResolvedValue({ count: 1 });
    mail.sendEmail.mockResolvedValue({ ok: true, sent: 1 });
    push.pushToUsers.mockResolvedValue(1);
    held.heldPayoutSummary.mockResolvedValue({ count: 0, totalMinor: 0 });
  });

  it("emails and pushes a due vendor their percentage, and records it", async () => {
    db.provider.findMany.mockResolvedValue([liveVendor]);
    await expect(sendSetupReminders(now)).resolves.toEqual({ checked: 1, sent: 1, failed: 0 });

    expect(db.provider.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", setupRemindersSent: 0 },
      data: { setupReminderSentAt: now, setupRemindersSent: { increment: 1 } },
    });
    const message = mail.sendEmail.mock.calls[0][0];
    expect(message.to).toBe("folly@example.com");
    expect(message.subject).toContain("45% set up");
    expect(push.pushToUsers).toHaveBeenCalledWith(["u1"], expect.objectContaining({ title: "Your storefront is 45% set up" }));
  });

  it("leads with held earnings when there are any", async () => {
    db.provider.findMany.mockResolvedValue([liveVendor]);
    held.heldPayoutSummary.mockResolvedValue({ count: 2, totalMinor: 8_400 });
    await sendSetupReminders(now);
    expect(mail.sendEmail.mock.calls[0][0].subject).toContain("£84.00 is waiting for you");
  });

  it("skips vendors not due yet", async () => {
    db.provider.findMany.mockResolvedValue([{ ...liveVendor, setupReminderSentAt: daysAgo(3), setupRemindersSent: 1 }]);
    await expect(sendSetupReminders(now)).resolves.toEqual({ checked: 1, sent: 0, failed: 0 });
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("hands the claim back when the email doesn't send", async () => {
    db.provider.findMany.mockResolvedValue([liveVendor]);
    mail.sendEmail.mockResolvedValue({ ok: false, reason: "SEND_FAILED" });
    await expect(sendSetupReminders(now)).resolves.toEqual({ checked: 1, sent: 0, failed: 1 });
    expect(db.provider.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { setupReminderSentAt: null, setupRemindersSent: 0 },
    });
    expect(push.pushToUsers).not.toHaveBeenCalled();
  });
});

describe("vendorSetupReminderEmail", () => {
  it("lists what's left and escapes vendor-supplied text", () => {
    const email = vendorSetupReminderEmail({
      name: "<Folly>",
      percent: 45,
      live: false,
      missing: ["Profile photo", "Bank linked for payouts"],
      heldLabel: null,
      url: "https://glamnetapp.com/provider/onboarding?step=review",
    });
    expect(email.subject).toBe("You're 45% of the way to going live on GLAMNET");
    expect(email.html).toContain("&lt;Folly&gt;");
    expect(email.html).not.toContain("<Folly>");
    expect(email.text).toContain("- Bank linked for payouts");
  });
});
