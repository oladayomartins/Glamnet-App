import { ukAddDays, ukDateString, ukParts, ukStartOfDay } from "./uk-time";

/**
 * The "When" field's choices — the third field in the search bar, beside
 * Treatment and Location.
 *
 * This is the field that turns a directory into something you can act on:
 * without it a customer can only ask "who does braids in Dagenham", when the
 * question they actually have is "who does braids in Dagenham *on Saturday*".
 * The search engine has taken a `date` all along; nothing ever offered one.
 *
 * Days are built in UK time, like everything else that decides availability
 * (see uk-time.ts). Building them from the browser's clock would give a
 * customer in another timezone a "Today" the availability engine disagrees
 * with — an empty results page for a day that is perfectly open.
 *
 * Labels are assembled from the tables below rather than with
 * `Intl.DateTimeFormat`, and that is not stylistic. These options render on
 * the server and then hydrate in the browser, and the two run different ICU
 * builds: Node produced "Mon 28 Sept" where Chromium produced "Mon, 28 Sept",
 * which React reported as a hydration mismatch. Fixed strings render
 * identically everywhere.
 */

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export interface WhenOption {
  /** The `date` query parameter. "" means no constraint. */
  value: string;
  label: string;
}

/** How many days ahead the field offers. Matches the booking horizon. */
export const WHEN_HORIZON_DAYS = 14;

/**
 * "Any time", "Today", "Tomorrow", then named days.
 *
 * The first option is deliberately empty rather than defaulting to today:
 * most customers have no fixed day in mind, and forcing one on them would
 * hide every vendor who is busy this afternoon but free all week.
 */
export function whenOptions(
  now: Date,
  horizonDays = WHEN_HORIZON_DAYS,
): WhenOption[] {
  const today = ukStartOfDay(now);
  const options: WhenOption[] = [{ value: "", label: "Any time" }];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = ukAddDays(today, offset);
    options.push({ value: ukDateString(day), label: dayLabel(day, offset) });
  }

  return options;
}

function dayLabel(day: Date, offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const { weekday, day: date, month } = ukParts(day);
  return `${WEEKDAY_SHORT[weekday]} ${date} ${MONTH_SHORT[month - 1]}`;
}

/**
 * What the field should read for a `date` already in the URL.
 *
 * A day outside the horizon — a stale link, or a hand-edited parameter — is
 * shown as itself rather than silently reset to "Any time", so the page never
 * claims to be unfiltered while the results are filtered.
 */
export function whenLabel(value: string, now: Date): string {
  if (!value) return "Any time";

  const match = whenOptions(now).find((option) => option.value === value);
  if (match) return match.label;

  // Midday UTC so the date cannot slip either side of a timezone boundary.
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Any time";

  const { day, month, year } = ukParts(parsed);
  return `${day} ${MONTH_SHORT[month - 1]} ${year}`;
}
