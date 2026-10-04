import { describe, expect, it } from "vitest";
import { messagingOpen } from "../messaging";

const now = new Date("2026-10-10T12:00:00Z");
const base = {
  status: "CONFIRMED",
  paymentStatus: "AUTHORISED",
  providerId: "p1",
  appointmentStartAt: new Date("2026-10-12T10:00:00Z"),
};

describe("messagingOpen", () => {
  it("is open on a paid booking with a vendor", () => {
    expect(messagingOpen(base, now)).toBe(true);
  });

  it("is closed until a vendor has the job", () => {
    expect(messagingOpen({ ...base, providerId: null, status: "BROADCAST" }, now)).toBe(false);
  });

  it("is closed on an abandoned checkout and an expired request", () => {
    expect(messagingOpen({ ...base, status: "ACCEPTED", paymentStatus: "PENDING_AUTHORISATION" }, now)).toBe(false);
    expect(messagingOpen({ ...base, status: "EXPIRED" }, now)).toBe(false);
  });

  it("stays open for a week after the appointment, then closes", () => {
    const after = { ...base, status: "PAYMENT_RELEASED", appointmentStartAt: new Date("2026-10-04T13:00:00Z") };
    expect(messagingOpen(after, now)).toBe(true);
    expect(messagingOpen({ ...after, appointmentStartAt: new Date("2026-10-03T11:00:00Z") }, now)).toBe(false);
  });
});
