import { z } from "zod";
import { prisma } from "../prisma";
import { paymentGateway } from "../payments";
import { formatMoney } from "@/lib/domain/pricing";
import { isPromotionKey } from "@/lib/domain/promotions";
import { AdminError, audit } from "./core";

/** Admin management of paid promotions: what is sold, and what was bought. */

const price = z.number().int().min(0).max(1_000_000);

const productPatch = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(300),
    slots: z.number().int().min(0).max(100),
    price7Minor: price,
    price14Minor: price,
    price30Minor: price,
    isActive: z.boolean(),
  })
  .partial();

export async function updatePromotionProduct(actorEmail: string, key: string, raw: unknown) {
  if (!isPromotionKey(key)) throw new AdminError("No such promotion.", 404, "NOT_FOUND");
  const patch = productPatch.parse(raw);
  const current = await prisma.promotionProduct.findUnique({ where: { key } });
  if (!current) throw new AdminError("No such promotion.", 404, "NOT_FOUND");
  const next = { ...current, ...patch };
  if (next.isActive && next.price7Minor + next.price14Minor + next.price30Minor === 0) {
    throw new AdminError("Set a price for at least one length before putting this on sale.", 422);
  }
  // Fewer slots only limits new sales; promotions already bought keep running.
  const product = await prisma.promotionProduct.update({ where: { key }, data: patch });
  await audit(
    actorEmail,
    "promotion-product.update",
    { type: "PromotionProduct", id: key },
    `${product.name}: ${product.isActive ? "on sale" : "off"}, ${product.slots} slots, ${[7, 14, 30]
      .map((days) => `${days}d ${formatMoney(days === 7 ? product.price7Minor : days === 14 ? product.price14Minor : product.price30Minor)}`)
      .join(" / ")}`,
  );
  return product;
}

/**
 * Take a promotion down now, optionally refunding it in full. A refund goes
 * back to the vendor's card through Stripe; a free (admin) cancellation just
 * ends it.
 */
export async function cancelPromotion(actorEmail: string, id: string, raw: unknown) {
  const { refund, reason } = z
    .object({ refund: z.boolean().default(false), reason: z.string().trim().max(200).default("") })
    .parse(raw ?? {});
  const promotion = await prisma.promotion.findUnique({ where: { id }, include: { provider: { select: { name: true } } } });
  if (!promotion) throw new AdminError("That promotion no longer exists.", 404, "NOT_FOUND");
  if (promotion.status !== "PAID") throw new AdminError("Only paid promotions can be cancelled.");

  const now = new Date();
  const refundable = refund && promotion.amountMinor > 0 && promotion.paymentIntentId !== "";
  if (refund && !refundable) throw new AdminError("There's no card payment on this one to refund.", 422);
  if (refundable) {
    try {
      await paymentGateway().refundPayment({
        reference: `promotion-${promotion.id}`,
        paymentIntentId: promotion.paymentIntentId,
        amountMinor: promotion.amountMinor,
      });
    } catch (error) {
      throw new AdminError(`Stripe refused the refund: ${error instanceof Error ? error.message : "unknown error"}`, 502, "REFUND_FAILED");
    }
  }

  const note = [refundable ? `Refunded ${formatMoney(promotion.amountMinor)}` : "Cancelled", `by ${actorEmail}`, reason]
    .filter(Boolean)
    .join(" · ");
  await prisma.promotion.update({
    where: { id },
    data: {
      status: refundable ? "REFUNDED" : "CANCELLED",
      cancelledAt: now,
      // Ended now, so the slot goes straight back on sale. One that hadn't
      // started yet ends at its own start.
      endsAt: promotion.startsAt > now ? promotion.startsAt : now,
      note: `${promotion.note} — ${note}`.slice(0, 500),
    },
  });
  await audit(actorEmail, refundable ? "promotion.refund" : "promotion.cancel", { type: "Promotion", id }, `${promotion.provider.name}: ${note}`);
}
