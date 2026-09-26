/** Presentation helpers shared by every screen. */

export { formatMoney } from "@/lib/domain/pricing";
export { formatNotice } from "@/lib/domain/classification";
import { UK_TIME_ZONE, ukDateString, ukParts } from "@/lib/domain/uk-time";

/*
 * Every clock and calendar date here is UK time, wherever the code runs: the
 * server is in UTC, and a page it renders must show the same "09:00" the
 * browser will.
 */

/** "2h 15m", or "45m" under an hour. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * "18:00" — 24-hour time, for the vendor and admin apps.
 *
 * The two clocks are separate functions rather than one with a flag because
 * the choice is not a preference: the brand voice fixes 24-hour time for
 * vendors, who are reading a shift, and 12-hour for customers, who are
 * reading an appointment. A flag invites a screen to pick the wrong one.
 */
export function formatTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: UK_TIME_ZONE });
}

/** "6:00 pm" — 12-hour time, for every customer-facing screen. */
export function formatCustomerTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: UK_TIME_ZONE,
    })
    // en-GB renders "6:00 pm"; some runtimes narrow it to "6:00 p.m.".
    .replace(/\u202f/g, " ");
}

/** "Wed 1 Apr", with "Today" and "Tomorrow" called out. */
export function formatDay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const now = new Date();
  const target = ukDateString(date);
  if (target === ukDateString(now)) return "Today";
  const tomorrow = ukParts(now);
  if (target === ukDateString(new Date(Date.UTC(tomorrow.year, tomorrow.month - 1, tomorrow.day + 1, 12)))) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: UK_TIME_ZONE,
  });
}

/** "Today, 18:00" — the format the spec uses on the vendor broadcast. */
export function formatDayTime(value: Date | string): string {
  return `${formatDay(value)}, ${formatTime(value)}`;
}

/** "Today, 6:00 pm" — the same thing on a customer screen. */
export function formatCustomerDayTime(value: Date | string): string {
  return `${formatDay(value)}, ${formatCustomerTime(value)}`;
}

/** "YYYY-MM-DD" for the UK day, for date inputs and calendar query params. */
export function toDateInputValue(value: Date): string {
  return ukDateString(value);
}

/** Describe a configured surcharge, e.g. "25%" or "£15.00". */
export function describeSurcharge(
  surchargeType: string,
  surchargeValue: number,
): string {
  if (surchargeType === "FIXED") {
    return `£${Math.floor(surchargeValue / 100)}.${String(surchargeValue % 100).padStart(2, "0")}`;
  }
  const percent = surchargeValue / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}
