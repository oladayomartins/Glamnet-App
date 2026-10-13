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
  const [allCodes, usage, categories] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, include: { provider: { select: { name: true } } } }),
    prisma.promoRedemption.groupBy({
      by: ["promoCodeId"],
      where: LIVE,
      _count: true,
      _sum: { discountMinor: true },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);
  // GLAMNET's own codes are managed here; vendors manage theirs, and pay for them.
  const promos = allCodes.filter((promo) => promo.providerId === null);
  const vendorCodes = allCodes.filter((promo) => promo.providerId !== null);
  const usageFor = (id: string) => usage.find((row) => row.promoCodeId === id);
  const ours = new Set(promos.map((promo) => promo.id));
  const totalUses = usage.filter((row) => ours.has(row.promoCodeId)).reduce((sum, row) => sum + row._count, 0);
  const totalGiven = usage
    .filter((row) => ours.has(row.promoCodeId))
    .reduce((sum, row) => sum + (row._sum.discountMinor ?? 0), 0);

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

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Vendors&rsquo; own codes</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Codes vendors made for their own storefronts. The vendor pays for the discount, so these don&rsquo;t cost
          GLAMNET anything. Vendors manage them from their dashboard.
        </p>
        {vendorCodes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No vendor codes yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-glam border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">Discount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Uses</th>
                  <th className="px-3 py-2 text-right font-medium">Given</th>
                </tr>
              </thead>
              <tbody>
                {vendorCodes.map((promo) => (
                  <tr key={promo.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2 font-mono text-ink">{promo.code}</td>
                    <td className="px-3 py-2 text-ink">{promo.provider?.name}</td>
                    <td className="px-3 py-2 text-ink-muted">
                      {describePromo({ ...promo, discountType: promo.discountType as PromoDiscountType })}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{scheduleOf(promo).toLowerCase()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usageFor(promo.id)?._count ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(usageFor(promo.id)?._sum.discountMinor ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
