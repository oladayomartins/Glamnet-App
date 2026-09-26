import { ukWallClock } from "@/lib/domain/uk-time";

/**
 * Parse a date supplied in a query string.
 *
 * Two shapes have to work, because both occur in practice:
 *  - `YYYY-MM-DD`, which a calendar UI naturally sends. Parsed as UK
 *    midnight — not UTC, and not the server's own zone — so a day view
 *    shows the day the user picked.
 *  - a full ISO 8601 timestamp. Note that an unencoded `+00:00` offset arrives
 *    as ` 00:00` because `+` means "space" in a query string, so that case is
 *    repaired rather than rejected.
 *
 * Returns `null` when the value cannot be read as a date.
 */
export function parseQueryDate(value: string | null): Date | null {
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return ukWallClock(Number(year), Number(month), Number(day));
  }

  const repaired = value.replace(/ (\d{2}:\d{2})$/, "+$1");
  const parsed = new Date(repaired);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
