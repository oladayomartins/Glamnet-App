import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { paymentGateway } from "./payments";
import { siteUrl } from "@/lib/site";
import {
  CHECKOUT_HOLD_MINUTES,
  PROMOTION_SCOPE,
  earliestPromotionStart,
  isPromotionDays,
  isPromotionKey,
  promotionArea,
  promotionEnd,
  promotionPrice,
  slotsFreeNow,
  type PromotionKey,
} from "@/lib/domain/promotions";

/**
 * Vendors buying promotions (see lib/domain/promotions.ts for the model).
 *
 * A purchase reserves its slot first, as a PENDING row that holds it for
 * CHECKOUT_HOLD_MINUTES, then sends the vendor to Stripe Checkout. Payment is
 * confirmed by whichever arrives first, the vendor landing back on the
 * success page or the checkout.session.completed webhook, and both are
 * idempotent. A checkout nobody pays expires and gives the slot back.
 */

export class PromotionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly code = "PROMOTION_RULE",
  ) {
    super(message);
    this.name = "PromotionError";
  }
}

/** Rows that occupy a slot: paid and not over, or a checkout still in its hold. */
function holdingWhere(now: Date): Prisma.PromotionWhereInput {
  return {
    endsAt: { gt: now },
    OR: [{ status: "PAID" }, { status: "PENDING", holdExpiresAt: { gt: now } }],
  };
}

/** Everything a vendor sees on their Promote page. */
export async function vendorPromotionOverview(providerId: string, now = new Date()) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      approvalStatus: true,
      isVerified: true,
      slug: true,
      isAcceptingWork: true,
      hub: { select: { city: true } },
    },
  });
  if (!provider) return null;
  const city = provider.hub.city;

  const [products, holding, history] = await Promise.all([
    prisma.promotionProduct.findMany({ where: { isActive: true } }),
    prisma.promotion.findMany({
      where: {
        AND: [
          holdingWhere(now),
          {
            OR: [
              { productKey: { in: keysOf("CITY") }, city },
              { productKey: { in: keysOf("NATIONAL") }, city: "" },
            ],
          },
        ],
      },
      select: { providerId: true, productKey: true, startsAt: true, endsAt: true },
    }),
    prisma.promotion.findMany({
      where: { providerId, status: { in: ["PAID", "PENDING", "REFUNDED", "CANCELLED"] } },
      orderBy: { startsAt: "desc" },
      take: 30,
    }),
  ]);

  const offers = products
    .filter((product) => isPromotionKey(product.key))
    .sort((a, b) => order(a.key) - order(b.key))
    .map((product) => {
      const key = product.key as PromotionKey;
      const taken = holding.filter((row) => row.productKey === key);
      const own = taken.filter((row) => row.providerId === providerId);
      const ownEnd = own.reduce<Date | null>((latest, row) => (!latest || row.endsAt > latest ? row.endsAt : latest), null);
      const notBefore = ownEnd && ownEnd > now ? ownEnd : now;
      const packages = ([7, 14, 30] as const)
        .map((days) => {
          const priceMinor = promotionPrice(product, days);
          if (priceMinor === null) return null;
          const startsAt = earliestPromotionStart({ taken, capacity: product.slots, days, notBefore });
          return {
            days,
            priceMinor,
            startsAt: startsAt?.toISOString() ?? null,
            startsNow: startsAt !== null && startsAt.getTime() <= now.getTime(),
          };
        })
        .filter((value) => value !== null);
      return {
        key,
        name: product.name,
        description: product.description,
        scope: PROMOTION_SCOPE[key],
        slots: product.slots,
        slotsFree: slotsFreeNow(taken, product.slots, now),
        runningUntil: ownEnd && ownEnd > now ? ownEnd.toISOString() : null,
        packages,
      };
    })
    .filter((offer) => offer.packages.length > 0);

  return {
    city,
    isLive: provider.approvalStatus === "APPROVED" && provider.isVerified && provider.slug !== null,
    isAcceptingWork: provider.isAcceptingWork,
    offers,
    history,
    testMode: paymentGateway().mode === "simulated",
  };
}

const keysOf = (scope: "CITY" | "NATIONAL") =>
  (Object.keys(PROMOTION_SCOPE) as PromotionKey[]).filter((key) => PROMOTION_SCOPE[key] === scope);

const order = (key: string) => ["SEARCH_TOP", "DIRECTORY_FEATURED", "HOME_SPOTLIGHT"].indexOf(key);

/**
 * Reserve a slot and open a Stripe Checkout for it. Returns where to send the
 * vendor: Stripe's payment page, or straight to the success page when
 * payments are simulated.
 */
export async function startPromotionCheckout(input: {
  providerId: string;
  productKey: string;
  days: number;
  now?: Date;
}): Promise<{ promotionId: string; url: string }> {
  const now = input.now ?? new Date();
  if (!isPromotionKey(input.productKey) || !isPromotionDays(input.days)) {
    throw new PromotionError("Pick one of the promotions on the page.", 422, "INVALID_REQUEST");
  }
  const key = input.productKey;

  const provider = await prisma.provider.findUnique({
    where: { id: input.providerId },
    select: {
      id: true,
      name: true,
      email: true,
      approvalStatus: true,
      isVerified: true,
      slug: true,
      isAcceptingWork: true,
      hub: { select: { city: true } },
    },
  });
  if (!provider) throw new PromotionError("No vendor profile on this account.", 404, "NOT_FOUND");
  if (provider.approvalStatus !== "APPROVED" || !provider.isVerified || !provider.slug) {
    throw new PromotionError("Your storefront has to be live before you can promote it.");
  }
  if (!provider.isAcceptingWork) {
    throw new PromotionError("Turn new bookings back on first: a paused profile isn't shown, so a promotion would be wasted.");
  }
  const area = promotionArea(key, provider.hub.city);

  // Serializable, so two vendors racing for the last slot can't both get it.
  // The loser's transaction is aborted and retried here, when it re-reads the
  // slots and either fits or is told they're gone.
  const promotion = await withRetry(() => prisma.$transaction(
    async (tx) => {
      const product = await tx.promotionProduct.findUnique({ where: { key } });
      if (!product?.isActive) throw new PromotionError("That promotion isn't on sale right now.");
      const amountMinor = promotionPrice(product, input.days);
      if (amountMinor === null) throw new PromotionError("That length isn't on sale for this promotion.");

      const taken = await tx.promotion.findMany({
        where: { productKey: key, city: area, ...holdingWhere(now) },
        select: { providerId: true, status: true, startsAt: true, endsAt: true },
      });
      if (taken.some((row) => row.providerId === provider.id && row.status === "PENDING")) {
        throw new PromotionError("You have a checkout open for this already. Finish it, or wait a few minutes and try again.");
      }
      const ownEnd = taken
        .filter((row) => row.providerId === provider.id)
        .reduce<Date>((latest, row) => (row.endsAt > latest ? row.endsAt : latest), now);
      const startsAt = earliestPromotionStart({ taken, capacity: product.slots, days: input.days, notBefore: ownEnd });
      if (!startsAt) throw new PromotionError("Every slot is taken for the next three months. Try a shorter package.");

      return tx.promotion.create({
        data: {
          providerId: provider.id,
          productKey: key,
          city: area,
          days: input.days,
          amountMinor,
          status: "PENDING",
          startsAt,
          endsAt: promotionEnd(startsAt, input.days),
          holdExpiresAt: new Date(now.getTime() + CHECKOUT_HOLD_MINUTES * 60_000),
          note: product.name,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ));

  const base = `${siteUrl()}/provider/${provider.id}/promote`;
  try {
    const checkout = await paymentGateway().createCheckout({
      reference: `promotion-${promotion.id}`,
      amountMinor: promotion.amountMinor,
      name: `GLAMNET promotion: ${promotion.note} (${promotion.days} days)`,
      description: area ? `${provider.name}, ${area}` : provider.name,
      customerEmail: provider.email,
      successUrl: `${base}?paid=${promotion.id}`,
      cancelUrl: `${base}?cancelled=${promotion.id}`,
      // Comfortably inside the slot hold, so a payment can never land after
      // the slot has been given to someone else.
      expiresAt: new Date(now.getTime() + 31 * 60_000),
      metadata: { promotionId: promotion.id, providerId: provider.id },
    });
    await prisma.promotion.update({ where: { id: promotion.id }, data: { checkoutSessionId: checkout.sessionId } });
    return { promotionId: promotion.id, url: checkout.url };
  } catch (error) {
    await prisma.promotion.update({ where: { id: promotion.id }, data: { status: "EXPIRED", holdExpiresAt: now } });
    throw error;
  }
}

/** Re-run a serializable transaction that lost a write conflict (P2034). */
async function withRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!conflict || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.random() * 50));
    }
  }
}

/**
 * Mark a purchase paid once Stripe says so. Safe to call repeatedly, and from
 * the success page and the webhook at once: only a PENDING row changes.
 */
export async function confirmPromotion(promotionId: string): Promise<"PAID" | "PENDING" | "EXPIRED" | "OTHER"> {
  const promotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
  if (!promotion) return "OTHER";
  if (promotion.status === "PAID") return "PAID";
  if (promotion.status !== "PENDING" || !promotion.checkoutSessionId) return "OTHER";

  const state = await paymentGateway().checkoutState(promotion.checkoutSessionId);
  if (state.paid) {
    await prisma.promotion.updateMany({
      where: { id: promotion.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), paymentIntentId: state.paymentIntentId, holdExpiresAt: null },
    });
    return "PAID";
  }
  if (state.expired) {
    await expirePromotionCheckout(promotion.checkoutSessionId);
    return "EXPIRED";
  }
  return "PENDING";
}

/** A checkout that ran out unpaid: give the slot back. */
export async function expirePromotionCheckout(checkoutSessionId: string) {
  if (!checkoutSessionId) return;
  await prisma.promotion.updateMany({
    where: { checkoutSessionId, status: "PENDING" },
    data: { status: "EXPIRED", holdExpiresAt: new Date() },
  });
}

/** The vendor backed out of Stripe's page: release the slot now rather than in 40 minutes. */
export async function abandonPromotionCheckout(providerId: string, promotionId: string) {
  await prisma.promotion.updateMany({
    where: { id: promotionId, providerId, status: "PENDING" },
    data: { status: "EXPIRED", holdExpiresAt: new Date() },
  });
}

/**
 * Vendors whose `key` placement is running now and who are still live, i.e.
 * still shown at all. City is not filtered here: a vendor only appears in
 * results for their own area anyway.
 */
export async function promotedProviderIds(key: PromotionKey, now = new Date()): Promise<Set<string>> {
  try {
    const rows = await prisma.promotion.findMany({
      where: {
        productKey: key,
        status: "PAID",
        startsAt: { lte: now },
        endsAt: { gt: now },
        provider: { approvalStatus: "APPROVED", isAcceptingWork: true },
      },
      select: { providerId: true },
    });
    return new Set(rows.map((row) => row.providerId));
  } catch (error) {
    // Paid placements are extra: a failure here must not take a results
    // page down with it.
    console.error("[promotions] could not load placements", error);
    return new Set();
  }
}
