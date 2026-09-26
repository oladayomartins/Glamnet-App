/** Reporting periods for the Finance page, in UTC calendar months. */
export const RANGES = {
  month: "This month",
  last_month: "Last month",
  "30d": "Last 30 days",
  year: "This year",
  all: "All time",
} as const;
export type RangeKey = keyof typeof RANGES;

export function resolveRange(key: string | undefined, now = new Date()): { key: RangeKey; from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const range = (key && key in RANGES ? key : "month") as RangeKey;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  switch (range) {
    case "last_month":
      return { key: range, from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
    case "30d":
      return { key: range, from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: tomorrow };
    case "year":
      return { key: range, from: new Date(Date.UTC(y, 0, 1)), to: tomorrow };
    case "all":
      return { key: range, from: new Date(0), to: tomorrow };
    default:
      return { key: "month", from: new Date(Date.UTC(y, m, 1)), to: tomorrow };
  }
}
