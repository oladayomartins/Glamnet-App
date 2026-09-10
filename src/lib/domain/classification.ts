import {
  DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
  TRANSITION_BUFFER_MINUTES,
} from "./constants";
import type { BasketLine, BookingType, EmergencyPricingConfig } from "./types";

/**
 * Notice period in whole minutes between the booking being placed and the
 * appointment starting (spec §9):
 *
 *     notice_period_minutes = appointment_start_at - booking_created_at
 *
 * Truncated toward zero, so 719.9 minutes counts as 719 — i.e. a booking that
 * is a hair inside the window classifies as EMERGENCY rather than rounding out
 * of it. An appointment in the past yields a negative value.
 */
export function noticePeriodMinutes(
  bookingCreatedAt: Date,
  appointmentStartAt: Date,
): number {
  const deltaMs = appointmentStartAt.getTime() - bookingCreatedAt.getTime();
  return Math.trunc(deltaMs / 60_000);
}

/**
 * Classify a booking (spec §3):
 *
 *     IF notice_period_minutes <= threshold  -> EMERGENCY
 *     ELSE                                   -> NORMAL
 *
 * Always call this server-side. The customer supplies the appointment time;
 * they never supply the classification.
 */
export function classifyBooking(
  noticeMinutes: number,
  thresholdMinutes: number = DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
): BookingType {
  return noticeMinutes <= thresholdMinutes ? "EMERGENCY" : "NORMAL";
}

/**
 * Resolve the threshold in force. An inactive or not-yet-effective config row
 * falls back to the platform default rather than disabling emergency pricing.
 */
export function resolveThresholdMinutes(
  config: EmergencyPricingConfig | null | undefined,
  now: Date,
): number {
  if (!config) return DEFAULT_EMERGENCY_THRESHOLD_MINUTES;
  if (!config.isActive) return DEFAULT_EMERGENCY_THRESHOLD_MINUTES;
  if (config.effectiveFrom.getTime() > now.getTime()) {
    return DEFAULT_EMERGENCY_THRESHOLD_MINUTES;
  }
  return config.thresholdMinutes;
}

/** Total billable service duration of the basket, excluding the buffer. */
export function basketDurationMinutes(basket: readonly BasketLine[]): number {
  return basket.reduce((total, line) => total + line.durationMinutes, 0);
}

/**
 * The period the provider's calendar must reserve (spec §2):
 * total service duration + 15-minute transition period.
 */
export function reservedDurationMinutes(basket: readonly BasketLine[]): number {
  return basketDurationMinutes(basket) + TRANSITION_BUFFER_MINUTES;
}

/** Human-readable notice, e.g. "4h 35m" — used on the provider broadcast. */
export function formatNotice(minutes: number): string {
  if (minutes < 0) return "overdue";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}
