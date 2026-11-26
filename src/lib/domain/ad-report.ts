import { ukParts } from "./uk-time";

/**
 * An ad's performance report: views and clicks for each UK day it ran.
 *
 * Days are UK calendar days, stored as midnight UTC of that date, so a view
 * at 00:30 on a summer night counts to the day the visitor saw, not the day
 * before in UTC.
 */

/** The UK calendar date at an instant, as midnight UTC of that date. */
export function ukDay(at: Date): Date {
  const p = ukParts(at);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** "2026-11-26" for a stored day. */
export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export interface DayStat {
  day: string;
  impressions: number;
  clicks: number;
}

export interface AdReport {
  /** First and last UK day covered: the run so far, or the whole run once ended. */
  from: string;
  to: string;
  /** Days covered, counting both ends. */
  days: number;
  impressions: number;
  clicks: number;
  /** Clicks per view, 0–1, or null before the first view. */
  ctr: number | null;
  /** One row per day in the range, zeros included, oldest first. */
  daily: DayStat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A long-running ad's report shows at most this many days, the latest. */
export const REPORT_MAX_DAYS = 366;

/**
 * Build the report for an ad from its daily rows. The range runs from the
 * start date to the end date, or to today while it is still running (or
 * before a start in the future, just today). Lifetime totals come from the
 * ad itself, since views counted before daily tracking began only live there.
 */
export function buildAdReport(
  ad: { startsAt: Date; endsAt: Date | null; impressions: number; clicks: number },
  rows: Array<{ day: Date; impressions: number; clicks: number }>,
  now: Date = new Date(),
): AdReport {
  const today = ukDay(now);
  let first = ukDay(ad.startsAt);
  let last = ad.endsAt && ad.endsAt < now ? ukDay(new Date(ad.endsAt.getTime() - 1)) : today;
  if (last < first) last = first;
  if (first > today) first = last = today;
  const span = Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1;
  if (span > REPORT_MAX_DAYS) first = new Date(last.getTime() - (REPORT_MAX_DAYS - 1) * DAY_MS);

  const byDay = new Map(rows.map((row) => [dayKey(row.day), row]));
  const daily: DayStat[] = [];
  for (let at = first.getTime(); at <= last.getTime(); at += DAY_MS) {
    const key = dayKey(new Date(at));
    const row = byDay.get(key);
    daily.push({ day: key, impressions: row?.impressions ?? 0, clicks: row?.clicks ?? 0 });
  }

  return {
    from: dayKey(first),
    to: dayKey(last),
    days: span,
    impressions: ad.impressions,
    clicks: ad.clicks,
    ctr: ad.impressions > 0 ? ad.clicks / ad.impressions : null,
    daily,
  };
}

/** The report as a spreadsheet, one row per day then a total. */
export function adReportCsv(report: AdReport, name: string): string {
  const cell = (value: string | number) => {
    const text = String(value);
    // Quote, and stop a spreadsheet treating a leading = + - @ as a formula.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const pct = (views: number, clicks: number) => (views > 0 ? ((clicks / views) * 100).toFixed(2) : "");
  const lines = [
    [`Ad: ${name}`],
    [`${report.from} to ${report.to}`],
    [],
    ["Date", "Views", "Clicks", "CTR %"],
    ...report.daily.map((row) => [row.day, row.impressions, row.clicks, pct(row.impressions, row.clicks)]),
    ["Total", report.impressions, report.clicks, pct(report.impressions, report.clicks)],
  ];
  return lines.map((line) => line.map(cell).join(",")).join("\n") + "\n";
}
