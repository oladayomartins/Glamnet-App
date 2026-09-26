import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { scheduleOf } from "@/lib/server/admin/core";
import { describePromo, type PromoDiscountType } from "@/lib/domain/promo";
import { formatMoney } from "@/lib/domain/pricing";
import { AdminHeader, Stat } from "../_components/bits";
import { PromoManager } from "./promo-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Promo codes" };

const LIVE = { booking: { status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] }, paymentStatus: { not: "VOIDED" } } };

/** Discount codes customers enter at checkout, funded by GLAMNET. */
export default async function AdminPromosPage() {
  await requireRole("ADMIN", "/admin/promos");
  const [promos, usage, categories] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.promoRedemption.groupBy({
      by: ["promoCodeId"],
      where: LIVE,
      _count: true,
      _sum: { discountMinor: true },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);
  const usageFor = (id: string) => usage.find((row) => row.promoCodeId === id);
  const totalUses = usage.reduce((sum, row) => sum + row._count, 0);
  const totalGiven = usage.reduce((sum, row) => sum + (row._sum.discountMinor ?? 0), 0);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Promo codes"
        lede="Codes customers type at checkout. GLAMNET pays for every discount out of its own share of the booking, so a vendor's payout never changes. That share is also the most a code can take off one booking."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Codes" value={String(promos.length)} hint={`${promos.filter((p) => scheduleOf(p) === "LIVE").length} live now`} />
        <Stat label="Times used" value={String(totalUses)} hint="Live bookings only" />
        <Stat label="Given away" value={formatMoney(totalGiven)} tone="gold" hint="Funded by GLAMNET" />
      </section>
      <PromoManager
        categories={categories.map((category) => category.name)}
        promos={promos.map((promo) => ({
          id: promo.id,
          code: promo.code,
          description: promo.description,
          discountType: promo.discountType as PromoDiscountType,
          value: promo.value,
          maxDiscountMinor: promo.maxDiscountMinor,
          minSpendMinor: promo.minSpendMinor,
          firstBookingOnly: promo.firstBookingOnly,
          category: promo.category,
          maxRedemptions: promo.maxRedemptions,
          perCustomerLimit: promo.perCustomerLimit,
          startsAt: promo.startsAt.toISOString(),
          endsAt: promo.endsAt?.toISOString() ?? null,
          isActive: promo.isActive,
          schedule: scheduleOf(promo),
          label: describePromo({ ...promo, discountType: promo.discountType as PromoDiscountType }),
          uses: usageFor(promo.id)?._count ?? 0,
          givenMinor: usageFor(promo.id)?._sum.discountMinor ?? 0,
        }))}
      />
    </div>
  );
}
