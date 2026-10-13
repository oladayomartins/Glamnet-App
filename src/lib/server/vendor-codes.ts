import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { scheduleOf } from "./admin/core";
import { describePromo, normalisePromoCode, PROMO_CODE_PATTERN, type PromoDiscountType } from "@/lib/domain/promo";

/**
 * A vendor's own discount codes: "AMARA10", 10% off at their storefront.
 *
 * Unlike GLAMNET's codes, the vendor pays for these — the discount comes off
 * their service price, and commission is taken on the discounted price — so
 * the rules are theirs to set. They only ever work on that vendor's own
 * storefront. A code that has been used can be paused but not changed or
 * deleted, so every booking can still be explained.
 */

/** The most a vendor's code can take off: 90%, or £500. */
export const VENDOR_CODE_MAX_PERCENT_BPS = 9_000;
export const VENDOR_CODE_MAX_FIXED_MINOR = 50_000;
/** Codes per vendor, live or not. */
export const VENDOR_CODE_LIMIT = 25;

const LIVE_BOOKING = {
  status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] },
  paymentStatus: { not: "VOIDED" },
};

export interface VendorCodeInput {
  code: string;
  description?: string;
  discountType: PromoDiscountType;
  /** Basis points for PERCENT, pence for FIXED. */
  value: number;
  minSpendMinor?: number;
  firstBookingOnly?: boolean;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

function fail(message: string, status = 422): never {
  throw new BookingError(message, "INVALID_TRANSITION", status);
}

function check(input: VendorCodeInput) {
  if (!PROMO_CODE_PATTERN.test(input.code)) fail("Codes are 3–24 letters, numbers or dashes, like AMARA10.");
  if (!Number.isInteger(input.value) || input.value < 1) fail("Set how much the code takes off.");
  if (input.discountType === "PERCENT" && input.value > VENDOR_CODE_MAX_PERCENT_BPS) {
    fail(`A code can take off at most ${VENDOR_CODE_MAX_PERCENT_BPS / 100}%.`);
  }
  if (input.discountType === "FIXED" && input.value > VENDOR_CODE_MAX_FIXED_MINOR) {
    fail(`A code can take off at most £${VENDOR_CODE_MAX_FIXED_MINOR / 100}.`);
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) fail("The end date must be after the start date.");
}

export async function listVendorCodes(providerId: string, now = new Date()) {
  const codes = await prisma.promoCode.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } });
  const usage = codes.length
    ? await prisma.promoRedemption.groupBy({
        by: ["promoCodeId"],
        where: { promoCodeId: { in: codes.map((code) => code.id) }, booking: LIVE_BOOKING },
        _count: true,
        _sum: { discountMinor: true },
      })
    : [];
  return codes.map((code) => {
    const used = usage.find((row) => row.promoCodeId === code.id);
    return {
      id: code.id,
      code: code.code,
      description: code.description,
      label: describePromo({ ...code, discountType: code.discountType as PromoDiscountType }),
      discountType: code.discountType as PromoDiscountType,
      value: code.value,
      minSpendMinor: code.minSpendMinor,
      firstBookingOnly: code.firstBookingOnly,
      maxRedemptions: code.maxRedemptions,
      perCustomerLimit: code.perCustomerLimit,
      startsAt: code.startsAt.toISOString(),
      endsAt: code.endsAt?.toISOString() ?? null,
      isActive: code.isActive,
      schedule: scheduleOf(code, now),
      uses: used?._count ?? 0,
      givenMinor: used?._sum.discountMinor ?? 0,
    };
  });
}

export async function createVendorCode(providerId: string, raw: VendorCodeInput) {
  const input = { ...raw, code: normalisePromoCode(raw.code) };
  check(input);
  const count = await prisma.promoCode.count({ where: { providerId } });
  if (count >= VENDOR_CODE_LIMIT) fail(`You can have up to ${VENDOR_CODE_LIMIT} codes. Delete an unused one first.`);
  if (await prisma.promoCode.findUnique({ where: { code: input.code }, select: { id: true } })) {
    fail(`${input.code} is taken. Try another — adding your name helps, like ${input.code.slice(0, 16)}-${new Date().getFullYear() % 100}.`, 409);
  }
  return prisma.promoCode.create({
    data: {
      providerId,
      code: input.code,
      description: (input.description ?? "").trim().slice(0, 200),
      discountType: input.discountType,
      value: input.value,
      minSpendMinor: input.minSpendMinor ?? 0,
      firstBookingOnly: input.firstBookingOnly ?? false,
      maxRedemptions: input.maxRedemptions ?? 0,
      perCustomerLimit: input.perCustomerLimit ?? 1,
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      endsAt: input.endsAt ?? null,
      createdBy: `provider:${providerId}`,
    },
  });
}

async function own(providerId: string, id: string) {
  const code = await prisma.promoCode.findUnique({ where: { id } });
  if (!code || code.providerId !== providerId) fail("Code not found.", 404);
  return code;
}

/** Pause or resume a code. Works whether or not it has been used. */
export async function setVendorCodeActive(providerId: string, id: string, isActive: boolean) {
  await own(providerId, id);
  return prisma.promoCode.update({ where: { id }, data: { isActive } });
}

/** Delete a code nobody has used yet; a used one is paused instead. */
export async function deleteVendorCode(providerId: string, id: string) {
  await own(providerId, id);
  const used = await prisma.promoRedemption.count({ where: { promoCodeId: id } });
  if (used > 0) fail("This code has been used, so it's kept for your records. Pause it instead.", 409);
  await prisma.promoCode.delete({ where: { id } });
}
