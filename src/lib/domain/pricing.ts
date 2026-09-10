import { TRUST_FEE_MINOR } from "./constants";
import type {
  BasketLine,
  BookingType,
  EmergencyPricingConfig,
} from "./types";

/**
 * A single line on the customer-facing price breakdown. Every component of the
 * total is itemised so the checkout can show the emergency surcharge *before*
 * payment authorisation (spec §4: "The customer should not discover the
 * additional charge only after submitting the booking.").
 */
export interface PriceLine {
  key: string;
  label: string;
  amountMinor: number;
  /** Marks the emergency surcharge so the UI can style it prominently. */
  emphasis?: "emergency";
}

export interface PriceBreakdown {
  bookingType: BookingType;
  lines: PriceLine[];
  /** Base services + add-ons, before fees and surcharges. */
  subtotalMinor: number;
  travelFeeMinor: number;
  /** Zero on a NORMAL booking. */
  emergencySurchargeMinor: number;
  otherSurchargesMinor: number;
  trustFeeMinor: number;
  totalMinor: number;
  /** Share of the total paid out to the provider, incl. their surge share. */
  providerEarningsMinor: number;
  /** The provider's portion of the emergency surcharge specifically. */
  providerEmergencyEarningsMinor: number;
}

export interface OtherSurcharge {
  key: string;
  label: string;
  amountMinor: number;
}

export interface PricingInput {
  basket: readonly BasketLine[];
  bookingType: BookingType;
  /** Fixed travel fee for the matched sector. */
  travelFeeMinor: number;
  /** Non-emergency surcharges (peak hour, bank holiday, …). */
  otherSurcharges?: readonly OtherSurcharge[];
  emergencyConfig: EmergencyPricingConfig | null;
  /** Provider's share of the booking, in basis points. Default 70%. */
  providerCommissionBps?: number;
  /** Provider's share of the emergency surcharge, in bps. Default 70%. */
  providerEmergencyShareBps?: number;
}

const DEFAULT_PROVIDER_COMMISSION_BPS = 7_000;

/**
 * Multiply a pence amount by a basis-point rate, rounding half-up.
 * Integer-only so repeated pricing never drifts.
 */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

/**
 * Emergency surcharge for a basket (spec §5). The type and amount are
 * commercial parameters read from the admin config — never hard-coded.
 *
 * A PERCENTAGE surcharge is charged on the service subtotal (base services +
 * premium add-ons), not on the travel fee or trust fee.
 */
export function emergencySurchargeMinor(
  serviceSubtotalMinor: number,
  config: EmergencyPricingConfig | null,
  now: Date,
): number {
  if (!config || !config.isActive) return 0;
  if (config.effectiveFrom.getTime() > now.getTime()) return 0;

  if (config.surchargeType === "FIXED") {
    return Math.max(0, Math.round(config.surchargeValue));
  }
  return Math.max(0, applyBps(serviceSubtotalMinor, config.surchargeValue));
}

/**
 * Server-side pricing engine (spec §5).
 *
 *   NORMAL     = base services + add-ons + travel + other surcharges + trust fee
 *   EMERGENCY  = the same, plus the emergency surcharge
 *
 * `now` is injected rather than read from the clock so pricing is deterministic
 * and testable, and so a quote and the booking it becomes price identically.
 */
export function priceBooking(
  input: PricingInput,
  now: Date = new Date(),
): PriceBreakdown {
  const {
    basket,
    bookingType,
    travelFeeMinor,
    otherSurcharges = [],
    emergencyConfig,
    providerCommissionBps = DEFAULT_PROVIDER_COMMISSION_BPS,
    providerEmergencyShareBps = DEFAULT_PROVIDER_COMMISSION_BPS,
  } = input;

  const lines: PriceLine[] = [];

  const services = basket.filter((line) => line.kind === "SERVICE");
  const addons = basket.filter((line) => line.kind === "ADDON");

  for (const line of services) {
    lines.push({
      key: `service:${line.id}`,
      label: line.name,
      amountMinor: line.priceMinor,
    });
  }
  for (const line of addons) {
    lines.push({
      key: `addon:${line.id}`,
      label: `${line.name} (add-on)`,
      amountMinor: line.priceMinor,
    });
  }

  const subtotalMinor = basket.reduce((sum, line) => sum + line.priceMinor, 0);

  lines.push({
    key: "travel",
    label: "Travel fee",
    amountMinor: travelFeeMinor,
  });

  const surcharge =
    bookingType === "EMERGENCY"
      ? emergencySurchargeMinor(subtotalMinor, emergencyConfig, now)
      : 0;

  if (surcharge > 0) {
    lines.push({
      key: "emergency",
      label: "Emergency booking surcharge",
      amountMinor: surcharge,
      emphasis: "emergency",
    });
  }

  let otherSurchargesMinor = 0;
  for (const extra of otherSurcharges) {
    otherSurchargesMinor += extra.amountMinor;
    lines.push({
      key: `surcharge:${extra.key}`,
      label: extra.label,
      amountMinor: extra.amountMinor,
    });
  }

  lines.push({
    key: "trust",
    label: "Trust fee",
    amountMinor: TRUST_FEE_MINOR,
  });

  const totalMinor =
    subtotalMinor +
    travelFeeMinor +
    surcharge +
    otherSurchargesMinor +
    TRUST_FEE_MINOR;

  // The provider earns a share of the service work and of the surge, plus the
  // travel fee in full. The trust fee is a platform fee and is never shared.
  const providerEmergencyEarningsMinor = applyBps(
    surcharge,
    providerEmergencyShareBps,
  );
  const providerEarningsMinor =
    applyBps(subtotalMinor, providerCommissionBps) +
    travelFeeMinor +
    providerEmergencyEarningsMinor;

  return {
    bookingType,
    lines,
    subtotalMinor,
    travelFeeMinor,
    emergencySurchargeMinor: surcharge,
    otherSurchargesMinor,
    trustFeeMinor: TRUST_FEE_MINOR,
    totalMinor,
    providerEarningsMinor,
    providerEmergencyEarningsMinor,
  };
}

/** Format integer pence as GBP, e.g. 12550 -> "£125.50". */
export function formatMoney(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
