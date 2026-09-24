import { z } from "zod";
import { prisma } from "../prisma";
import { normalisePromoCode, PROMO_CODE_PATTERN } from "@/lib/domain/promo";
import { AdminError, audit } from "./core";

/** Admin management of promo codes. */

const dateField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Not a valid date." });
      return z.NEVER;
    }
    return date;
  });

const promoInput = z
  .object({
    code: z.string().trim().transform(normalisePromoCode),
    description: z.string().trim().max(200).default(""),
    discountType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
    /** Basis points for PERCENT, pence for FIXED. */
    value: z.number().int().min(1),
    maxDiscountMinor: z.number().int().min(0).max(1_000_000).default(0),
    minSpendMinor: z.number().int().min(0).max(10_000_000).default(0),
    firstBookingOnly: z.boolean().default(false),
    category: z.string().trim().max(80).default(""),
    maxRedemptions: z.number().int().min(0).max(1_000_000).default(0),
    perCustomerLimit: z.number().int().min(0).max(1_000).default(1),
    startsAt: dateField,
    endsAt: dateField,
    isActive: z.boolean().default(true),
  });

function checkRules(input: { code?: string; discountType?: string; value?: number; startsAt?: Date | null; endsAt?: Date | null }) {
  if (input.code !== undefined && !PROMO_CODE_PATTERN.test(input.code)) {
    throw new AdminError("Codes are 3–24 letters, numbers or dashes, e.g. WELCOME10.", 422);
  }
  if (input.discountType === "PERCENT" && input.value !== undefined && input.value > 10_000) {
    throw new AdminError("A percentage can't be more than 100%.", 422);
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    throw new AdminError("The end date must be after the start date.", 422);
  }
}

async function checkCategory(category: string | undefined) {
  if (!category) return;
  const exists = await prisma.category.findUnique({ where: { name: category } });
  if (!exists) throw new AdminError("Pick one of the categories in the list.", 422);
}

export async function createPromo(actorEmail: string, raw: unknown) {
  const { startsAt, endsAt, ...rest } = promoInput.parse(raw);
  checkRules({ ...rest, startsAt, endsAt });
  await checkCategory(rest.category);
  if (await prisma.promoCode.findUnique({ where: { code: rest.code } })) {
    throw new AdminError(`The code ${rest.code} already exists.`);
  }
  const promo = await prisma.promoCode.create({
    data: { ...rest, ...(startsAt ? { startsAt } : {}), endsAt: endsAt ?? null, createdBy: actorEmail },
  });
  await audit(actorEmail, "promo.create", { type: "PromoCode", id: promo.id }, promo.code);
  return promo;
}

export async function updatePromo(actorEmail: string, id: string, raw: unknown) {
  const { startsAt, endsAt, ...rest } = promoInput.partial().parse(raw);
  const current = await prisma.promoCode.findUnique({ where: { id } });
  if (!current) throw new AdminError("That code no longer exists.", 404, "NOT_FOUND");
  checkRules({
    ...rest,
    discountType: rest.discountType ?? current.discountType,
    value: rest.value ?? current.value,
    startsAt: startsAt ?? current.startsAt,
    endsAt: endsAt === undefined ? current.endsAt : endsAt,
  });
  await checkCategory(rest.category);
  if (rest.code && rest.code !== current.code) {
    const used = await prisma.promoRedemption.count({ where: { promoCodeId: id } });
    if (used > 0) throw new AdminError("A code that has been used can't be renamed. Create a new one instead.");
    if (await prisma.promoCode.findUnique({ where: { code: rest.code } })) {
      throw new AdminError(`The code ${rest.code} already exists.`);
    }
  }
  const promo = await prisma.promoCode.update({
    where: { id },
    data: { ...rest, ...(startsAt ? { startsAt } : {}), ...(endsAt !== undefined ? { endsAt } : {}) },
  });
  const action =
    rest.isActive === true && !current.isActive
      ? "promo.activate"
      : rest.isActive === false && current.isActive
        ? "promo.pause"
        : "promo.update";
  await audit(actorEmail, action, { type: "PromoCode", id }, promo.code);
  return promo;
}

/** Only an unused code is deleted; a used one is kept for the books. */
export async function deletePromo(actorEmail: string, id: string) {
  const current = await prisma.promoCode.findUnique({ where: { id } });
  if (!current) throw new AdminError("That code no longer exists.", 404, "NOT_FOUND");
  const used = await prisma.promoRedemption.count({ where: { promoCodeId: id } });
  if (used > 0) throw new AdminError("This code has been used, so it's kept for your records. Pause it instead.");
  await prisma.promoCode.delete({ where: { id } });
  await audit(actorEmail, "promo.delete", { type: "PromoCode", id }, current.code);
}
