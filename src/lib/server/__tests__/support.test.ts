import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  supportEnquiry: { count: vi.fn(), create: vi.fn() },
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/lib/server/prisma", () => ({ prisma: db }));
vi.mock("@/lib/server/email", () => mail);

const { submitEnquiry } = await import("@/lib/server/support");

const valid = {
  role: "CUSTOMER",
  category: "PAYMENT",
  topic: "Where's my refund?",
  bookingRef: "bk_123",
  name: "Ada Obi",
  email: "ada@example.com",
  message: "My refund hasn't arrived after two weeks.",
};

describe("submitEnquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.supportEnquiry.count.mockResolvedValue(0);
    db.supportEnquiry.create.mockImplementation(async ({ data }) => ({ id: "e1", ...data }));
    mail.sendEmail.mockResolvedValue({ ok: true, sent: 1 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saves it and emails the team (reply-to the sender) and the sender", async () => {
    const result = await submitEnquiry(valid, "u1");
    expect(result).toMatchObject({ ok: true, reference: expect.stringMatching(/^GN-/) });
    expect(db.supportEnquiry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "CUSTOMER", category: "PAYMENT", bookingRef: "bk_123", appUserId: "u1", urgent: false }),
    });
    const recipients = mail.sendEmail.mock.calls.map(([message]) => message.to);
    expect(recipients).toEqual(["support@glamnetapp.com", "ada@example.com"]);
    expect(mail.sendEmail.mock.calls[0][0].replyTo).toBe("ada@example.com");
  });

  it("leaves the team email to Web3Forms when it's set up", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "public-key");
    await submitEnquiry(valid, null);
    expect(mail.sendEmail.mock.calls.map(([message]) => message.to)).toEqual(["ada@example.com"]);
  });

  it("refuses a topic that doesn't belong to the category or role", async () => {
    expect(await submitEnquiry({ ...valid, topic: "Held earnings" }, null)).toMatchObject({ ok: false, status: 422 });
    expect(await submitEnquiry({ ...valid, category: "PAYOUTS", topic: "Held earnings" }, null)).toMatchObject({ ok: false, status: 422 });
    expect(db.supportEnquiry.create).not.toHaveBeenCalled();
  });

  it("flags safety reports as urgent", async () => {
    await submitEnquiry({ ...valid, category: "SAFETY", topic: "I felt unsafe" }, null);
    expect(db.supportEnquiry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ urgent: true }) });
  });

  it("rejects bots that fill the hidden field", async () => {
    await expect(submitEnquiry({ ...valid, website: "spam.example" }, null)).rejects.toThrow();
    expect(db.supportEnquiry.create).not.toHaveBeenCalled();
  });

  it("limits how many one address can send in an hour", async () => {
    db.supportEnquiry.count.mockResolvedValue(5);
    expect(await submitEnquiry(valid, null)).toMatchObject({ ok: false, status: 429 });
  });
});
