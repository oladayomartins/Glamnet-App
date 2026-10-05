import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { formatMoney } from "@/lib/format";
import { PROMOTION_KEYS, PROMOTION_SCOPE, PROMOTION_WHERE, promotionState, type PromotionKey } from "@/lib/domain/promotions";
import { AdminHeader, Stat } from "../_components/bits";
import { PromotionManager } from "./promotion-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Promotions" };

/** Paid placements vendors buy: what is on sale, and every purchase. */
export default async function AdminPromotionsPage() {
  await requireRole("ADMIN", "/admin/promotions");
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [products, purchases, paidLast30, paidAll] = await Promise.all([
    prisma.promotionProduct.findMany(),
    prisma.promotion.findMany({
      where: { status: { in: ["PAID", "REFUNDED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { provider: { select: { name: true, slug: true } } },
    }),
    prisma.promotion.aggregate({ where: { status: "PAID", paidAt: { gte: monthAgo } }, _sum: { amountMinor: true } }),
    prisma.promotion.aggregate({ where: { status: "PAID" }, _sum: { amountMinor: true } }),
  ]);

  const rows = purchases.map((promotion) => ({
    id: promotion.id,
    vendor: promotion.provider.name,
    vendorSlug: promotion.provider.slug,
    product: promotion.note.split(" — ")[0] || promotion.productKey,
    city: promotion.city,
    days: promotion.days,
    amountMinor: promotion.amountMinor,
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    state: promotionState(promotion, now),
    note: promotion.note.split(" — ").slice(1).join(" — "),
    refundable: promotion.amountMinor > 0 && promotion.paymentIntentId !== "",
  }));
  const live = rows.filter((row) => row.state === "LIVE").length;
  const booked = rows.filter((row) => row.state === "SCHEDULED").length;

  return (
    <div>
      <AdminHeader
        title="Promotions"
        lede="Placements vendors pay for: top of search, featured in their city, and the home page spotlight. Each is a fixed price for 7, 14 or 30 days, with a limited number of slots. Clients always see them marked Sponsored."
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue, last 30 days" value={formatMoney(paidLast30._sum.amountMinor ?? 0)} tone="gold" />
        <Stat label="Revenue, all time" value={formatMoney(paidAll._sum.amountMinor ?? 0)} hint="Refunds excluded" />
        <Stat label="Live now" value={String(live)} />
        <Stat label="Booked to start" value={String(booked)} />
      </div>
      <PromotionManager
        products={PROMOTION_KEYS.flatMap((key: PromotionKey) => {
          const product = products.find((row) => row.key === key);
          return product
            ? [
                {
                  key,
                  name: product.name,
                  description: product.description,
                  where: PROMOTION_WHERE[key],
                  scope: PROMOTION_SCOPE[key],
                  slots: product.slots,
                  price7Minor: product.price7Minor,
                  price14Minor: product.price14Minor,
                  price30Minor: product.price30Minor,
                  isActive: product.isActive,
                },
              ]
            : [];
        })}
        purchases={rows}
      />
    </div>
  );
}
