/** Presentation helpers shared by every screen. */

export { formatMoney } from "@/lib/domain/pricing";
export { formatNotice } from "@/lib/domain/classification";

/** "2h 15m", or "45m" under an hour. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** "18:00" in the viewer's locale. */
export function formatTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "Wed 1 Apr", with "Today" and "Tomorrow" called out. */
export function formatDay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayDelta = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1_000),
  );
  if (dayDelta === 0) return "Today";
  if (dayDelta === 1) return "Tomorrow";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Today, 6:00 PM" — the format the spec uses on the provider broadcast. */
export function formatDayTime(value: Date | string): string {
  return `${formatDay(value)}, ${formatTime(value)}`;
}

/** "YYYY-MM-DD" in local time, for date inputs and calendar query params. */
export function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
