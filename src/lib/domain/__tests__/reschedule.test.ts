import { describe, expect, it } from "vitest";
import { latestStartForHold, MAX_RESCHEDULES, newTimeProblem, rescheduleBlocker } from "../reschedule";

const now = new Date("2026-10-10T12:00:00Z");
const booking = {
  status: "CONFIRMED",
  paymentStatus: "CARD_SAVED",
  providerId: "p1",
  appointmentStartAt: new Date("2026-10-20T10:00:00Z"),
  holdAuthorisedAt: null,
  rescheduleCount: 0,
};

describe("rescheduleBlocker", () => {
  it("allows a confirmed, paid booking", () => {
    expect(rescheduleBlocker(booking)).toBeNull();
  });

  it("refuses once someone has set off or the job is under way", () => {
    expect(rescheduleBlocker({ ...booking, status: "PROVIDER_EN_ROUTE" })).not.toBeNull();
    expect(rescheduleBlocker({ ...booking, status: "IN_PROGRESS" })).not.toBeNull();
  });

  it("refuses without a card in place", () => {
    expect(rescheduleBlocker({ ...booking, paymentStatus: "AUTHORISATION_FAILED" })).toMatch(/card/);
  });

  it("caps how many times a booking moves", () => {
    expect(rescheduleBlocker({ ...booking, rescheduleCount: MAX_RESCHEDULES })).toMatch(/Cancel it and book again/);
  });
});

describe("newTimeProblem", () => {
  it("accepts a later free time on a saved card", () => {
    expect(newTimeProblem(booking, new Date("2026-11-02T10:00:00Z"), now)).toBeNull();
  });

  it("refuses the same time, a time within the hour, and one too far ahead", () => {
    expect(newTimeProblem(booking, booking.appointmentStartAt, now)).toMatch(/already booked/);
    expect(newTimeProblem(booking, new Date("2026-10-10T12:30:00Z"), now)).toMatch(/an hour/);
    expect(newTimeProblem(booking, new Date("2026-11-20T10:00:00Z"), now)).toMatch(/28 days/);
  });

  it("keeps a held card's booking inside the hold's life", () => {
    const held = {
      ...booking,
      paymentStatus: "AUTHORISED",
      appointmentStartAt: new Date("2026-10-12T10:00:00Z"),
      holdAuthorisedAt: new Date("2026-10-09T09:00:00Z"),
    };
    expect(latestStartForHold(held)?.toISOString()).toBe("2026-10-14T09:00:00.000Z");
    expect(newTimeProblem(held, new Date("2026-10-13T15:00:00Z"), now)).toBeNull();
    expect(newTimeProblem(held, new Date("2026-10-15T10:00:00Z"), now)).toMatch(/hold/);
  });
});
