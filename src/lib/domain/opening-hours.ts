import type { WorkingWindow } from "./availability";

/**
 * Presenting a provider's working week.
 *
 * The storefront and the provider's own dashboard must never disagree about
 * which days someone works — a storefront that says "closed today" while the
 * dashboard says "working" is the exact bug this module exists to rule out.
 * It does that by deriving everything below from the same
 * `ProviderAvailability` rows the dashboard edits, rather than from a second,
 * separately-maintained "opening hours" field that could drift out of step.
 *
 * Pure: minutes in, strings out. No dates, no timezone, no database.
 */

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface DayHours {
  dayOfWeek: number;
  name: string;
  /** Every shift that day, earliest first. Empty means closed. */
  windows: { startMinute: number; endMinute: number }[];
}

/** 540 -> "09:00". 1_170 -> "19:30". */
export function formatMinuteOfDay(minute: number): string {
  const normalised = ((minute % 1_440) + 1_440) % 1_440;
  const hours = Math.floor(normalised / 60);
  const minutes = normalised % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * All seven days, Monday first.
 *
 * Monday first rather than Sunday first because that is how a UK customer
 * reads a week — even though `Date#getDay` numbers it the other way, which is
 * why the numbering is kept and only the *order* changes.
 */
export function weeklyHours(windows: readonly WorkingWindow[]): DayHours[] {
  const order = [1, 2, 3, 4, 5, 6, 0];

  return order.map((dayOfWeek) => ({
    dayOfWeek,
    name: WEEKDAY_NAMES[dayOfWeek],
    windows: windows
      .filter((window) => window.dayOfWeek === dayOfWeek)
      .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }))
      .sort((a, b) => a.startMinute - b.startMinute),
  }));
}

/** "09:00 – 18:00", or both shifts when a day is split. "Closed" when empty. */
export function describeDayHours(day: DayHours): string {
  if (day.windows.length === 0) return "Closed";
  return day.windows
    .map(
      (window) =>
        `${formatMinuteOfDay(window.startMinute)} – ${formatMinuteOfDay(window.endMinute)}`,
    )
    .join(", ");
}

/**
 * "Open until 18:00" when the provider is inside a shift right now.
 *
 * Deliberately a claim about *shift hours only*: it says the provider is at
 * work, not that they are free — a fully booked provider is still open. The
 * "next available" line is what speaks to actual bookability, and conflating
 * the two would promise a slot this function knows nothing about.
 */
export function openUntil(
  windows: readonly WorkingWindow[],
  dayOfWeek: number,
  minuteOfDay: number,
): string | null {
  const current = windows
    .filter((window) => window.dayOfWeek === dayOfWeek)
    .filter(
      (window) =>
        minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute,
    )
    .sort((a, b) => b.endMinute - a.endMinute)[0];

  return current ? `Open until ${formatMinuteOfDay(current.endMinute)}` : null;
}
