import { applyBps } from "./pricing";

/**
 * Promo code rules. Pure, so every refusal message and every discount is
 * testable without a database.
 *
 * Every code is GLAMNET-funded: the discount comes out of the platform's own
 * share of the booking and the vendor is paid exactly what they would have
 * been. That share is the hard ceiling on any discount — see `settle()`.
 */

export type PromoDiscountType = "PERCENT" | "FIXED";

export interface PromoRule {
  code: string;
  discountType: PromoDiscountType;
  /** Basis points for PERCENT (1000 = 10%), pence for FIXED. */
  value: number;
  maxDiscountMinor: number;
  minSpendMinor: number;
  firstBookingOnly: boolean;
  category: string;
  maxRedemptions: number;
  perCustomerLimit: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PromoContext {
  now: Date;
  /** The basket's service and add-on lines. */
  lines: { category: string; priceMinor: number }[];
  /** Live redemptions of this code by anyone. */
  totalRedemptions: number;
  /** Live redemptions of this code by this customer. */
  customerRedemptions: number;
  /** This customer's live bookings on GLAMNET before this one. */
  customerPriorBookings: number;
  /** The most GLAMNET can give away on this booking. */
  platformShareMinor: number;
}

export type PromoOutcome =
  | { ok: true; discountMinor: number; limitedByShare: boolean }
  | { ok: false; reason: string };

/** What a customer typed → the stored form. "  welcome 10 " → "WELCOME10". */
export function normalisePromoCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

const pounds = (minor: number) =>
  `£${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;

export function describePromo(rule: Pick<PromoRule, "discountType" | "value" | "maxDiscountMinor">): string {
  if (rule.discountType === "FIXED") return `${pounds(rule.value)} off`;
  const pct = `${rule.value / 100}% off`;
  return rule.maxDiscountMinor > 0 ? `${pct} (up to ${pounds(rule.maxDiscountMinor)})` : pct;
}

export function evaluatePromo(rule: PromoRule, ctx: PromoContext): PromoOutcome {
  if (!rule.isActive) return { ok: false, reason: "This code is no longer active." };
  if (rule.startsAt > ctx.now) return { ok: false, reason: "This code isn't active yet." };
  if (rule.endsAt && rule.endsAt <= ctx.now) return { ok: false, reason: "This code has expired." };
  if (rule.maxRedemptions > 0 && ctx.totalRedemptions >= rule.maxRedemptions) {
    return { ok: false, reason: "This code has been fully used." };
  }
  if (rule.perCustomerLimit > 0 && ctx.customerRedemptions >= rule.perCustomerLimit) {
    return { ok: false, reason: "You've already used this code." };
  }
  if (rule.firstBookingOnly && ctx.customerPriorBookings > 0) {
    return { ok: false, reason: "This code is for your first GLAMNET booking." };
  }

  const eligible = rule.category
    ? ctx.lines.filter((line) => line.category === rule.category)
    : ctx.lines;
  if (eligible.length === 0) {
    return { ok: false, reason: `This code only applies to ${rule.category} services.` };
  }
  const baseMinor = eligible.reduce((sum, line) => sum + line.priceMinor, 0);
  if (baseMinor < rule.minSpendMinor) {
    return {
      ok: false,
      reason: `Spend ${pounds(rule.minSpendMinor)} or more${rule.category ? ` on ${rule.category}` : ""} to use this code.`,
    };
  }

  let discount =
    rule.discountType === "PERCENT" ? applyBps(baseMinor, rule.value) : rule.value;
  if (rule.maxDiscountMinor > 0) discount = Math.min(discount, rule.maxDiscountMinor);
  discount = Math.min(discount, baseMinor);

  const share = Math.max(0, ctx.platformShareMinor);
  const limitedByShare = discount > share;
  discount = Math.min(discount, share);

  if (discount <= 0) {
    return { ok: false, reason: "This code can't be used on this booking." };
  }
  return { ok: true, discountMinor: discount, limitedByShare };
}
