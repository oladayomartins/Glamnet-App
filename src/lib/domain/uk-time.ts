/**
 * UK wall-clock time, whatever time zone the server runs in.
 *
 * Vendors' working hours ("09:00–18:00 on Saturdays") and calendar days are
 * UK wall-clock times. Production runs in UTC, so anything built with
 * `Date#setHours` or read with `getDay()` there is an hour out all summer.
 * Every day boundary and weekday in the availability engine goes through
 * here instead.
 */

export const UK_TIME_ZONE = "Europe/London";

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface UkParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, like `Date#getDay`. */
  weekday: number;
}

/** The UK calendar date and clock time at an instant. */
export function ukParts(at: Date): UkParts {
  const parts: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(at)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** Minutes the UK is ahead of UTC at an instant: 0 in winter, 60 in summer. */
export function ukOffsetMinutes(at: Date): number {
  const p = ukParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1_000) * 1_000) / 60_000);
}

/**
 * The instant at which the UK clock reads `minutes` past midnight on the
 * given date. Month and day may run over (day 32 is the 1st of next month).
 *
 * On the spring clocks-change day the hour 01:00–02:00 doesn't exist; a time
 * inside it lands an hour later, as a clock would. In autumn 01:00–02:00
 * happens twice; the second (GMT) one is used. Neither hour is in anyone's
 * working day, and midnight is never ambiguous.
 */
export function ukWallClock(year: number, month: number, day: number, minutes = 0): Date {
  const naive = Date.UTC(year, month - 1, day) + minutes * 60_000;
  // Guess with the offset at the naive instant, then correct once with the
  // offset at the guess: the two only differ across a clocks change.
  const first = naive - ukOffsetMinutes(new Date(naive)) * 60_000;
  const second = naive - ukOffsetMinutes(new Date(first)) * 60_000;
  // In the spring gap neither guess reads back as the asked-for time; the
  // later one is the clock's own answer (01:30 → 02:30).
  return new Date(Math.max(first, second));
}

/** UK midnight at the start of the UK day containing `at`. */
export function ukStartOfDay(at: Date): Date {
  const p = ukParts(at);
  return ukWallClock(p.year, p.month, p.day);
}

/** The same UK clock time `days` calendar days later (or earlier). */
export function ukAddDays(at: Date, days: number): Date {
  const p = ukParts(at);
  return ukWallClock(p.year, p.month, p.day + days, p.hour * 60 + p.minute + p.second / 60);
}

/** "YYYY-MM-DD" for the UK calendar day containing `at`. */
export function ukDateString(at: Date): string {
  const p = ukParts(at);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
