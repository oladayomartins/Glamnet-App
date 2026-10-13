import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "./prisma";
import {
  describePromo,
  evaluatePromo,
  normalisePromoCode,
  type PromoContext,
  type PromoDiscountType,
  type PromoOutcome,
} from "@/lib/domain/promo";

/**
 * Promo codes at checkout: look a code up, count its live uses, and decide
 * the discount. The rules themselves are in the pure domain module.
 */


/** A redemption or booking only counts while the booking is still live. */
const LIVE_BOOKING: Prisma.BookingWhereInput = {
  status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] },
  paymentStatus: { not: "VOIDED" },
};

export interface PromoResult {
  code: string;
  promoCodeId: string | null;
  label: string;
  outcome: PromoOutcome;
  /** A vendor's own code: the discount comes off their price, not GLAMNET's share. */
  vendorFunded: boolean;
}

/**
 * Live uses of a code. "Prior bookings" are the customer's bookings anywhere
 * on GLAMNET for a GLAMNET code, and with that vendor for a vendor's own code.
 */
async function usage(db: Db, promoCodeId: string, customerId: string, providerId: string | null) {
  const [totalRedemptions, customerRedemptions, customerPriorBookings] = await Promise.all([
    db.promoRedemption.count({ where: { promoCodeId, booking: LIVE_BOOKING } }),
    customerId
      ? db.promoRedemption.count({ where: { promoCodeId, customerId, booking: LIVE_BOOKING } })
      : Promise.resolve(0),
    customerId
      ? db.booking.count({ where: { customerId, ...(providerId ? { providerId } : {}), ...LIVE_BOOKING } })
      : Promise.resolve(0),
  ]);
  return { totalRedemptions, customerRedemptions, customerPriorBookings };
}

/**
 * Evaluate a typed code against a basket. Never throws for a bad code: the
 * refusal is returned so the checkout can show it next to the field.
 */
export async function evaluatePromoCode(
  rawCode: string,
  input: Omit<PromoContext, "totalRedemptions" | "customerRedemptions" | "customerPriorBookings"> & {
    customerId: string;
    /** The storefront being booked: a vendor's code works only on their own. */
    providerId?: string;
  },
  db: Db = prisma,
): Promise<PromoResult> {
  const code = normalisePromoCode(rawCode);
  const promo = code
    ? await db.promoCode.findUnique({ where: { code }, include: { provider: { select: { name: true } } } })
    : null;
  if (!promo) {
    return { code, promoCodeId: null, label: "", vendorFunded: false, outcome: { ok: false, reason: "That code isn't recognised." } };
  }
  const vendorFunded = promo.providerId !== null;
  const label = describePromo({ ...promo, discountType: promo.discountType as PromoDiscountType });
  if (vendorFunded && promo.providerId !== input.providerId) {
    return {
      code,
      promoCodeId: promo.id,
      label,
      vendorFunded,
      outcome: { ok: false, reason: `This code is for ${promo.provider?.name ?? "another pro"}'s storefront only.` },
    };
  }
  const counts = await usage(db, promo.id, input.customerId, promo.providerId);
  const outcome = evaluatePromo(
    { ...promo, discountType: promo.discountType as PromoDiscountType, ownerName: promo.provider?.name ?? null },
    // A vendor gives their own discount: GLAMNET's share is no ceiling on it.
    { ...input, ...counts, ...(vendorFunded ? { platformShareMinor: Number.MAX_SAFE_INTEGER } : {}) },
  );
  return { code, promoCodeId: promo.id, label, vendorFunded, outcome };
}
