import { ukParts, ukWallClock } from "@/lib/domain/uk-time";

/**
 * Test fixtures in UK wall-clock time: "2026-04-01T09:00:00" is 09:00 in the
 * UK, whatever zone the tests run in (production's server runs in UTC).
 */
export function uk(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(iso);
  if (!match) throw new Error(`Not a wall-clock time: ${iso}`);
  const [, year, month, day, hour, minute] = match.map(Number);
  return ukWallClock(year, month, day, hour * 60 + minute);
}

/** The UK clock and calendar at an instant. */
export const ukAt = ukParts;
