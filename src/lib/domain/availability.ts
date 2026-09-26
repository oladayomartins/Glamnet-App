import { SLOT_GRANULARITY_MINUTES, TRANSITION_BUFFER_MINUTES } from "./constants";
import type { Interval } from "./types";
import { ukAddDays, ukParts, ukStartOfDay, ukWallClock } from "./uk-time";

/** A vendor's recurring weekly working window, in UK wall-clock minutes. */
export interface WorkingWindow {
  /** 0 = Sunday … 6 = Saturday, as the UK calendar has it. */
  dayOfWeek: number;
  /** Minutes from midnight, e.g. 09:00 -> 540. */
  startMinute: number;
  /** Minutes from midnight, e.g. 18:00 -> 1080. */
  endMinute: number;
}

export interface ProviderSchedule {
  providerId: string;
  workingWindows: readonly WorkingWindow[];
  /** Confirmed bookings, already inclusive of their transition buffer. */
  reservations: readonly Interval[];
  /** Holiday / manually blocked periods. */
  blocks: readonly Interval[];
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}

/**
 * Half-open overlap test: `[aStart, aEnd)` vs `[bStart, bEnd)`.
 *
 * Half-open is what makes back-to-back bookings legal — a reservation ending
 * at 14:15 does not conflict with one starting at 14:15, but any earlier start
 * does.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt.getTime() < b.endAt.getTime() &&
    b.startAt.getTime() < a.endAt.getTime();
}

/**
 * The window a booking actually occupies in a vendor's calendar (spec §2):
 * service duration + the 15-minute transition period.
 *
 * A 12:00–14:00 booking reserves 12:00–14:15.
 */
export function reservationWindow(
  appointmentStartAt: Date,
  serviceDurationMinutes: number,
): Interval {
  return {
    startAt: appointmentStartAt,
    endAt: addMinutes(
      appointmentStartAt,
      serviceDurationMinutes + TRANSITION_BUFFER_MINUTES,
    ),
  };
}

/** True when `window` sits entirely inside one of the vendor's working windows. */
export function withinWorkingHours(
  window: Interval,
  workingWindows: readonly WorkingWindow[],
): boolean {
  const dayStart = startOfLocalDay(window.startAt);
  const weekday = ukParts(dayStart).weekday;
  return workingWindows.some((shift) => {
    if (weekday !== shift.dayOfWeek) return false;
    // Via the wall clock, not minutes after midnight: on a clocks-change day
    // 09:00 is not 540 minutes after midnight.
    const shiftStart = atMinute(dayStart, shift.startMinute);
    const shiftEnd = atMinute(dayStart, shift.endMinute);
    return (
      window.startAt.getTime() >= shiftStart.getTime() &&
      window.endAt.getTime() <= shiftEnd.getTime()
    );
  });
}

/**
 * Whether a vendor can take a booking starting at `appointmentStartAt`.
 *
 * This is the single gate used by both the customer slot picker and the
 * emergency broadcast matcher, which is what guarantees spec §7: an emergency
 * booking never overrides an existing commitment. Classification does not
 * enter into it — the availability rules are identical for NORMAL and
 * EMERGENCY.
 */
export function isProviderAvailable(
  schedule: ProviderSchedule,
  appointmentStartAt: Date,
  serviceDurationMinutes: number,
): boolean {
  const required = reservationWindow(appointmentStartAt, serviceDurationMinutes);

  if (!withinWorkingHours(required, schedule.workingWindows)) return false;
  if (schedule.reservations.some((held) => overlaps(required, held))) return false;
  if (schedule.blocks.some((block) => overlaps(required, block))) return false;

  return true;
}

/**
 * UK midnight for the UK day containing `at`.
 *
 * "Local" means the UK, not the server: production runs in UTC, and a
 * server-local midnight there is 01:00 in the UK all summer.
 */
export function startOfLocalDay(at: Date): Date {
  return ukStartOfDay(at);
}

/** The same UK clock time `days` calendar days after `at`. */
export function addDays(at: Date, days: number): Date {
  return ukAddDays(at, days);
}

/** Monday-based start of the UK week containing `at`. */
export function startOfWeek(at: Date): Date {
  const day = startOfLocalDay(at);
  const offset = (ukParts(day).weekday + 6) % 7;
  return addDays(day, -offset);
}

/** The UK weekday of `at`: 0 = Sunday … 6 = Saturday. */
export function ukWeekday(at: Date): number {
  return ukParts(at).weekday;
}

/** The instant the UK clock reads `minute` past midnight on `dayStart`'s day. */
function atMinute(dayStart: Date, minute: number): Date {
  const day = ukParts(dayStart);
  return ukWallClock(day.year, day.month, day.day, minute);
}

export interface SlotOption {
  startAt: Date;
  endAt: Date;
  /** Vendors who can serve this slot — drives the broadcast shortlist. */
  availableProviderIds: string[];
}

/**
 * Every start time on `date` that falls inside at least one qualified
 * vendor's working hours — whether or not anyone is actually free to take
 * it.
 *
 * The customer's slot grid needs the unservable times as well as the servable
 * ones: a grid that silently omits 16:00 reads as "we do not work then",
 * whereas "no vendor free" is the truth and is worth showing. Eligibility is
 * still decided here, on the server — the client only renders what comes back.
 */
export function buildDayGrid(
  date: Date,
  serviceDurationMinutes: number,
  schedules: readonly ProviderSchedule[],
  notBefore: Date,
): SlotOption[] {
  const dayStart = startOfLocalDay(date);
  const dayEnd = addDays(dayStart, 1);
  const grid: SlotOption[] = [];

  for (
    let cursor = dayStart;
    cursor.getTime() < dayEnd.getTime();
    cursor = addMinutes(cursor, SLOT_GRANULARITY_MINUTES)
  ) {
    if (cursor.getTime() < notBefore.getTime()) continue;

    const required = reservationWindow(cursor, serviceDurationMinutes);
    const onShift = schedules.filter((schedule) =>
      withinWorkingHours(required, schedule.workingWindows),
    );
    if (onShift.length === 0) continue;

    grid.push({
      startAt: new Date(cursor),
      endAt: addMinutes(cursor, serviceDurationMinutes),
      availableProviderIds: onShift
        .filter((schedule) =>
          isProviderAvailable(schedule, cursor, serviceDurationMinutes),
        )
        .map((schedule) => schedule.providerId),
    });
  }

  return grid;
}

export type DayStatus = "closed" | "full" | "free";

export interface DaySummary {
  /** UK midnight of the day. */
  date: Date;
  /** closed: not a working day; full: working, but nothing fits; free: bookable. */
  status: DayStatus;
  /** The earliest bookable start that day, when there is one. */
  firstStartAt: Date | null;
}

/**
 * One vendor's next `days` days at a glance, for a day picker that greys out
 * closed and full days and opens on the first free one.
 */
export function summariseDays(
  from: Date,
  days: number,
  serviceDurationMinutes: number,
  schedule: ProviderSchedule,
  notBefore: Date,
): DaySummary[] {
  const start = startOfLocalDay(from);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const grid = buildDayGrid(date, serviceDurationMinutes, [schedule], notBefore);
    const first = grid.find((slot) => slot.availableProviderIds.length > 0);
    return {
      date,
      status: first ? "free" : grid.length === 0 && !worksOn(schedule, date) ? "closed" : "full",
      firstStartAt: first ? first.startAt : null,
    };
  });
}

function worksOn(schedule: ProviderSchedule, date: Date): boolean {
  const weekday = ukWeekday(date);
  return schedule.workingWindows.some((window) => window.dayOfWeek === weekday);
}

/**
 * Every start time on `date` that at least one vendor can serve for a basket
 * of `serviceDurationMinutes`.
 *
 * Slots are generated at 15-minute granularity, filtered against each
 * vendor's real calendar, and any slot starting before `notBefore` (normally
 * "now") is dropped so the picker cannot offer a time in the past.
 */
export function buildSlotOptions(
  date: Date,
  serviceDurationMinutes: number,
  schedules: readonly ProviderSchedule[],
  notBefore: Date,
): SlotOption[] {
  return buildDayGrid(date, serviceDurationMinutes, schedules, notBefore).filter(
    (slot) => slot.availableProviderIds.length > 0,
  );
}
