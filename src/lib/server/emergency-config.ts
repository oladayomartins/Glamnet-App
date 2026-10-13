import { prisma } from "./prisma";
import {
  DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
  TRUST_FEE_MINOR,
} from "@/lib/domain/constants";
import type { EmergencyPricingConfig } from "@/lib/domain/types";

/**
 * The emergency pricing configuration in force at `now`.
 *
 * Config rows are append-only, so "in force" means the most recent row whose
 * effective date has passed. If that row is inactive, emergency pricing is
 * off: publishing an inactive row is how an admin switches it off, so it must
 * not fall back to the older active row it was meant to replace. Returns
 * `null` when off or nothing is configured, which the pricing engine treats
 * as a zero surcharge rather than an error.
 */
export async function getActiveEmergencyConfig(
  now: Date = new Date(),
): Promise<EmergencyPricingConfig | null> {
  const row = await prisma.emergencyPricingConfig.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!row || !row.isActive) return null;

  return {
    thresholdMinutes: row.thresholdMinutes,
    surchargeType: row.surchargeType === "FIXED" ? "FIXED" : "PERCENTAGE",
    surchargeValue: row.surchargeValue,
    effectiveFrom: row.effectiveFrom,
    isActive: row.isActive,
  };
}

/** Values the checkout and admin screens need to explain the current rules. */
export async function getPricingContext(now: Date = new Date()) {
  const config = await getActiveEmergencyConfig(now);
  return {
    config,
    thresholdMinutes: config?.thresholdMinutes ?? DEFAULT_EMERGENCY_THRESHOLD_MINUTES,
    trustFeeMinor: TRUST_FEE_MINOR,
  };
}
