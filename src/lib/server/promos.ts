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
  status: { notIn: ["CANCELLED", "EXPIRED"] },
  paymentStatus: { not: "VOIDED" },
};

export interface PromoResult {
  code: string;
  promoCodeId: string | null;
  label: string;
  outcome: PromoOutcome;
}

async function usage(db: Db, promoCodeId: string, customerId: string) {
  const [totalRedemptions, customerRedemptions, customerPriorBookings] = await Promise.all([
    db.promoRedemption.count({ where: { promoCodeId, booking: LIVE_BOOKING } }),
    customerId
      ? db.promoRedemption.count({ where: { promoCodeId, customerId, booking: LIVE_BOOKING } })
      : Promise.resolve(0),
    customerId ? db.booking.count({ where: { customerId, ...LIVE_BOOKING } }) : Promise.resolve(0),
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
  },
  db: Db = prisma,
): Promise<PromoResult> {
  const code = normalisePromoCode(rawCode);
  const promo = code ? await db.promoCode.findUnique({ where: { code } }) : null;
  if (!promo) {
    return { code, promoCodeId: null, label: "", outcome: { ok: false, reason: "That code isn't recognised." } };
  }
  const counts = await usage(db, promo.id, input.customerId);
  const outcome = evaluatePromo(
    { ...promo, discountType: promo.discountType as PromoDiscountType },
    { ...input, ...counts },
  );
  return { code, promoCodeId: promo.id, label: describePromo({ ...promo, discountType: promo.discountType as PromoDiscountType }), outcome };
}
