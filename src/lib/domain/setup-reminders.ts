/**
 * When to remind a vendor to finish setting up.
 *
 * The first reminder goes two days after they started (or went live), so a
 * vendor mid-way through the wizard isn't interrupted; then one a week. They
 * stop after MAX_REMINDERS, once every step a vendor can do is done (the rest
 * is waiting on us), or once they're verified.
 */

export const FIRST_REMINDER_AFTER_DAYS = 2;
export const REMINDER_EVERY_DAYS = 7;
export const MAX_REMINDERS = 8;

const DAY_MS = 24 * 60 * 60 * 1_000;

export function setupReminderDue(input: {
  /** When they went live, or signed up if they haven't. */
  startedAt: Date;
  lastSentAt: Date | null;
  sentCount: number;
  verified: boolean;
  /** Every step but approval is done: nothing left for the vendor to do. */
  readyForApproval: boolean;
  now: Date;
}): boolean {
  if (input.verified || input.readyForApproval) return false;
  if (input.sentCount >= MAX_REMINDERS) return false;
  if (input.lastSentAt === null) {
    return input.now.getTime() - input.startedAt.getTime() >= FIRST_REMINDER_AFTER_DAYS * DAY_MS;
  }
  // A little slack, so a daily job that runs a few minutes early doesn't
  // slip the reminder a whole day.
  return input.now.getTime() - input.lastSentAt.getTime() >= REMINDER_EVERY_DAYS * DAY_MS - 60 * 60 * 1_000;
}
