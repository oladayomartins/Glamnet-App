/**
 * Platform-wide business constants.
 *
 * Anything the client may want to change *without a release* lives in the
 * database instead (see `EmergencyPricingConfig`). The values here are
 * structural rules of the marketplace, not commercial parameters.
 */

/**
 * Vendor transition/buffer period appended to every booking (spec §2, §7).
 * A 12:00–14:00 service reserves 12:00–14:15 in the vendor's calendar.
 */
export const TRANSITION_BUFFER_MINUTES = 15;

/**
 * Default emergency threshold (spec §3): 720 minutes = 12 hours.
 * Used only as a fallback when no active config row exists.
 */
export const DEFAULT_EMERGENCY_THRESHOLD_MINUTES = 720;

/** Fixed £0.50 Trust Fee applied to every booking (spec §5). */
export const TRUST_FEE_MINOR = 50;

/** Granularity of offered appointment start times. */
export const SLOT_GRANULARITY_MINUTES = 15;

/** Number of eligible vendors an accepted request is broadcast to (spec §13). */
export const BROADCAST_FANOUT = 5;

/** How long a vendor has to accept a broadcast before it lapses. */
export const BROADCAST_ACCEPTANCE_WINDOW_MINUTES = 10;
