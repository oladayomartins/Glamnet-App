import {
  addMinutes,
  isProviderAvailable,
  startOfLocalDay,
  type ProviderSchedule,
} from "@/lib/domain/availability";

/** The evening a "Free tonight" badge is a claim about: 18:00–22:00 today. */
const EVENING_FROM_MINUTE = 18 * 60;
const EVENING_TO_MINUTE = 22 * 60;

/**
 * A nominal single appointment. These probes answer "is there room at all?",
 * not "is there room for this basket" — the slot picker does the second, with
 * the customer's real duration.
 */
const PROBE_MINUTES = 60;
const PROBE_STEP_MINUTES = 30;

/**
 * Whether a vendor could still take an hour's work in `[from, to)` today.
 *
 * The probe runs through exactly the same gate as the customer slot
 * picker and the broadcast matcher — working hours, existing reservations
 * (which already carry the 15-minute transition) and blocked periods. That is
 * what stops a card badge or a filter from promising something the
 * availability engine would then refuse.
 */
function hasOpening(
  schedule: ProviderSchedule,
  now: Date,
  fromMinute: number,
  toMinute: number,
): boolean {
  const dayStart = startOfLocalDay(now);
  const latestStart = addMinutes(dayStart, toMinute - PROBE_MINUTES);

  for (
    let cursor = addMinutes(dayStart, fromMinute);
    cursor.getTime() <= latestStart.getTime();
    cursor = addMinutes(cursor, PROBE_STEP_MINUTES)
  ) {
    if (cursor.getTime() < now.getTime()) continue;
    if (isProviderAvailable(schedule, cursor, PROBE_MINUTES)) return true;
  }

  return false;
}

/** Backs the `Free tonight` badge — this evening specifically, not "today". */
export function isFreeTonight(schedule: ProviderSchedule, now: Date): boolean {
  return hasOpening(schedule, now, EVENING_FROM_MINUTE, EVENING_TO_MINUTE);
}

/** Backs the "available today" filter — anywhere in the rest of the day. */
export function hasOpeningToday(
  schedule: ProviderSchedule,
  now: Date,
): boolean {
  return hasOpening(schedule, now, 0, 24 * 60);
}

/** How far ahead a storefront will look before it stops claiming anything. */
export const NEXT_OPENING_HORIZON_DAYS = 14;

export interface NextOpening {
  at: Date;
  /** True when `at` falls on `now`'s own day — the storefront says "today". */
  isToday: boolean;
}

/**
 * The first moment this provider could take an hour's work, searching forward
 * from `now`.
 *
 * This backs the storefront's "Available today from 14:00" line, and it is the
 * reason that line can be trusted: it walks the same `isProviderAvailable`
 * gate as the slot picker and the broadcast matcher, so a storefront cannot
 * advertise an opening the booking flow would then refuse. A provider whose
 * dashboard says they are working and whose storefront says they are closed is
 * a contradiction this shares-one-gate arrangement rules out by construction.
 *
 * Returns null when nothing opens up inside the horizon — the storefront then
 * says nothing rather than guessing.
 */
export function nextOpening(
  schedule: ProviderSchedule,
  now: Date,
  horizonDays = NEXT_OPENING_HORIZON_DAYS,
): NextOpening | null {
  const today = startOfLocalDay(now);

  for (let day = 0; day < horizonDays; day += 1) {
    const dayStart = addMinutes(today, day * 24 * 60);
    const dayEnd = addMinutes(dayStart, 24 * 60);

    for (
      let cursor = dayStart;
      cursor.getTime() <= dayEnd.getTime() - PROBE_MINUTES * 60_000;
      cursor = addMinutes(cursor, PROBE_STEP_MINUTES)
    ) {
      if (cursor.getTime() < now.getTime()) continue;
      if (isProviderAvailable(schedule, cursor, PROBE_MINUTES)) {
        return { at: cursor, isToday: day === 0 };
      }
    }
  }

  return null;
}
