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
 * Whether a provider could still take an hour's work in `[from, to)` today.
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
