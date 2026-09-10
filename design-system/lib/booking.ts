/**
 * Domain constants the UI has to display truthfully.
 *
 * These are presentation constants only — the booking engine itself is out of
 * scope for this package. Classification and pricing are computed server-side
 * (see the brand guide, §08) and arrive on the booking record; the components
 * here render what they are given.
 */

/** Notice ≤ 720 minutes (12 hours) ⇒ EMERGENCY. */
export const EMERGENCY_THRESHOLD_MINUTES = 720;

/** Every booking blocks its service duration plus this transition period. */
export const TRANSITION_MINUTES = 15;

/** Flat per-booking trust fee, in pounds. */
export const TRUST_FEE = 0.5;

export type BookingType = "NORMAL" | "EMERGENCY";

/** Money is always £ with two decimals — never rounded to whole pounds. */
export function formatGbp(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

/** mm:ss for acceptance countdowns and notice timers. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
