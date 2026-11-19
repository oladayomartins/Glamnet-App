import { describe, expect, it } from "vitest";
import { MAX_REMINDERS, setupReminderDue } from "../setup-reminders";

const day = 24 * 60 * 60 * 1_000;
const now = new Date("2026-11-20T09:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * day);

const base = {
  startedAt: ago(3),
  lastSentAt: null,
  sentCount: 0,
  verified: false,
  readyForApproval: false,
  now,
};

describe("setupReminderDue", () => {
  it("waits two days before the first reminder", () => {
    expect(setupReminderDue({ ...base, startedAt: ago(1) })).toBe(false);
    expect(setupReminderDue({ ...base, startedAt: ago(2) })).toBe(true);
  });

  it("then sends one a week", () => {
    expect(setupReminderDue({ ...base, lastSentAt: ago(6), sentCount: 1 })).toBe(false);
    expect(setupReminderDue({ ...base, lastSentAt: ago(7), sentCount: 1 })).toBe(true);
  });

  it("tolerates the daily job running a little early", () => {
    expect(setupReminderDue({ ...base, lastSentAt: new Date(ago(7).getTime() + 30 * 60 * 1_000), sentCount: 1 })).toBe(true);
  });

  it("stops after the last reminder", () => {
    expect(setupReminderDue({ ...base, lastSentAt: ago(30), sentCount: MAX_REMINDERS })).toBe(false);
  });

  it("never reminds a vendor with nothing left to do", () => {
    expect(setupReminderDue({ ...base, verified: true })).toBe(false);
    expect(setupReminderDue({ ...base, readyForApproval: true })).toBe(false);
  });
});
