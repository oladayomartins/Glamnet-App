/** Shared domain vocabulary for the GLAMNET booking engine. */

/**
 * Emergency classification. Derived server-side from the notice period and
 * stored permanently against the booking (spec §8, §9).
 */
export type BookingType = "NORMAL" | "EMERGENCY";

/**
 * Operational lifecycle (spec §8). Runs orthogonally to {@link BookingType}:
 * a booking is e.g. EMERGENCY + IN_PROGRESS.
 */
export const BOOKING_STATUSES = [
  "REQUESTED",
  "BROADCAST",
  "ACCEPTED",
  "CONFIRMED",
  "ADDRESS_UNLOCKED",
  "PROVIDER_EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REVIEWED",
  "PAYMENT_RELEASED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Terminal states that sit outside the happy path. */
export const TERMINAL_STATUSES = ["CANCELLED", "EXPIRED", "DISPUTED"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export type AnyBookingStatus = BookingStatus | TerminalStatus;

/** The only legal forward transition out of each lifecycle status. */
export const NEXT_STATUS: Record<BookingStatus, BookingStatus | null> = {
  REQUESTED: "BROADCAST",
  BROADCAST: "ACCEPTED",
  ACCEPTED: "CONFIRMED",
  CONFIRMED: "ADDRESS_UNLOCKED",
  ADDRESS_UNLOCKED: "PROVIDER_EN_ROUTE",
  PROVIDER_EN_ROUTE: "ARRIVED",
  ARRIVED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: "REVIEWED",
  REVIEWED: "PAYMENT_RELEASED",
  PAYMENT_RELEASED: null,
};

/** A half-open interval `[startAt, endAt)` in absolute time. */
export interface Interval {
  startAt: Date;
  endAt: Date;
}

/** One line on the customer's service basket. */
export interface BasketLine {
  id: string;
  name: string;
  /** Minor units (pence). All money in this codebase is integer pence. */
  priceMinor: number;
  durationMinutes: number;
  kind: "SERVICE" | "ADDON";
}

export type SurchargeType = "PERCENTAGE" | "FIXED";

/**
 * Admin-configurable emergency commercial parameters (spec §5).
 * Never hard-coded: loaded from the `EmergencyPricingConfig` table.
 */
export interface EmergencyPricingConfig {
  /** Notice period at or below which a booking is EMERGENCY. Default 720. */
  thresholdMinutes: number;
  surchargeType: SurchargeType;
  /**
   * Basis points (1/100th of a percent) when PERCENTAGE, else pence when
   * FIXED. Integers throughout to avoid float drift on money.
   */
  surchargeValue: number;
  effectiveFrom: Date;
  isActive: boolean;
}
