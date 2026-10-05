import { WEEKDAY_NAMES } from "./opening-hours";
import type { WorkingWindow } from "./availability";

/**
 * The working week a vendor sets during onboarding.
 *
 * This step exists because without it a vendor finishes the wizard, gets an
 * approved storefront, and is **unbookable**: their opening hours read
 * "Closed" every day and the availability engine offers nobody a slot. Hours
 * were only editable from a settings page they had no reason to visit, so the
 * last step of signing up was invisible.
 *
 * One shift per day, matching the availability editor. The data model allows
 * several, but a vendor who genuinely splits a day is better served by
 * blocking the gap than by a second pair of time fields to mis-set — and the
 * editor already shows an existing split honestly rather than dropping one.
 */

export interface WorkingDay {
  dayOfWeek: number;
  label: string;
  working: boolean;
  /** "09:00" */
  start: string;
  /** "18:00" */
  end: string;
}

/** Monday first, the way a UK vendor reads their own week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

/**
 * Monday to Saturday, 9 to 6 — pre-ticked.
 *
 * Pre-filling is the whole point of putting this in the wizard: a vendor who
 * works ordinary hours taps Continue, and one who does not changes the two or
 * three days that differ. An empty week would be the same dead end as having
 * no step at all, just moved one screen earlier.
 *
 * Sunday is the one day left off, as the day most independent vendors do not
 * work. Being wrong there costs a vendor one tap; being wrong the other way
 * advertises hours they do not keep.
 */
export function defaultWorkingWeek(): WorkingDay[] {
  return WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    label: WEEKDAY_NAMES[dayOfWeek],
    working: dayOfWeek !== 0,
    start: DEFAULT_START,
    end: DEFAULT_END,
  }));
}

/** Rebuild the editable week from whatever is already saved. */
export function weekFromWindows(windows: readonly WorkingWindow[]): WorkingDay[] {
  if (windows.length === 0) return defaultWorkingWeek();

  return WEEK_ORDER.map((dayOfWeek) => {
    const forDay = windows.filter((window) => window.dayOfWeek === dayOfWeek);
    if (forDay.length === 0) {
      return {
        dayOfWeek,
        label: WEEKDAY_NAMES[dayOfWeek],
        working: false,
        start: DEFAULT_START,
        end: DEFAULT_END,
      };
    }
    // The widest span, so a day saved as two shifts is shown rather than half
    // of it silently disappearing.
    return {
      dayOfWeek,
      label: WEEKDAY_NAMES[dayOfWeek],
      working: true,
      start: toClock(Math.min(...forDay.map((w) => w.startMinute))),
      end: toClock(Math.max(...forDay.map((w) => w.endMinute))),
    };
  });
}

/** What the API is sent: only the days actually worked. */
export function weekToWindows(week: readonly WorkingDay[]): WorkingWindow[] {
  return week
    .filter((day) => day.working)
    .map((day) => ({
      dayOfWeek: day.dayOfWeek,
      startMinute: toMinutes(day.start),
      endMinute: toMinutes(day.end),
    }));
}

/**
 * Why this week cannot be saved, in the vendor's words. Null when it can.
 *
 * Checked here rather than left to the API because the wizard disables
 * Continue on it: a vendor needs to know what to change before they tap, not
 * after a request comes back.
 */
export function weekProblem(week: readonly WorkingDay[]): string | null {
  const working = week.filter((day) => day.working);
  if (working.length === 0) {
    return "Pick at least one day you work — clients can only book inside your hours.";
  }

  const backwards = working.find(
    (day) => toMinutes(day.start) >= toMinutes(day.end),
  );
  if (backwards) {
    return `${backwards.label} finishes before it starts.`;
  }

  return null;
}

/** 540 -> "09:00" */
function toClock(minute: number): string {
  const safe = Math.max(0, Math.min(1_440, minute));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** "09:00" -> 540. Anything unparseable is 0, which weekProblem then catches. */
function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}
