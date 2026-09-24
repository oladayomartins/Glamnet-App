import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Read-only numbers for the Overview and Finance pages.
 *
 * Money is summed from the settlement columns written when a booking is
 * priced, so these totals agree with what Stripe was told to move.
 */

const NOT_CANCELLED: Prisma.BookingWhereInput = { status: { notIn: ["CANCELLED", "EXPIRED"] } };

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function overviewStats() {
  const monthStart = startOfMonth();
  const [
    pendingVendors,
    liveVendors,
    suspendedVendors,
    customers,
    suspendedAccounts,
    bookingsThisMonth,
    money,
    openDisputes,
    awaitingPayment,
    liveCampaigns,
    liveAds,
  ] = await Promise.all([
    prisma.provider.count({ where: { approvalStatus: "PENDING", onboardedAt: { not: null } } }),
    prisma.provider.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.provider.count({ where: { approvalStatus: "SUSPENDED" } }),
    prisma.appUser.count({ where: { role: "CUSTOMER" } }),
    prisma.appUser.count({ where: { suspendedAt: { not: null } } }),
    prisma.booking.count({ where: { bookingCreatedAt: { gte: monthStart }, ...NOT_CANCELLED } }),
    prisma.booking.aggregate({
      where: { bookingCreatedAt: { gte: monthStart }, ...NOT_CANCELLED },
      _sum: { totalInvoicePriceMinor: true, platformCommissionMinor: true },
    }),
    prisma.booking.count({ where: { settlementStatus: "DISPUTED" } }),
    prisma.booking.count({ where: { paymentStatus: "PENDING_AUTHORISATION" } }),
    prisma.campaign.count({
      where: { isActive: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    }),
    prisma.adPlacement.count({
      where: { isActive: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    }),
  ]);

  return {
    pendingVendors,
    liveVendors,
    suspendedVendors,
    customers,
    suspendedAccounts,
    bookingsThisMonth,
    gmvThisMonthMinor: money._sum.totalInvoicePriceMinor ?? 0,
    commissionThisMonthMinor: money._sum.platformCommissionMinor ?? 0,
    openDisputes,
    awaitingPayment,
    liveCampaigns,
    liveAds,
  };
}

export async function financeSummary(range: { from: Date; to: Date }) {
  const where = { bookingCreatedAt: { gte: range.from, lt: range.to }, ...NOT_CANCELLED };
  const [totals, bySource, escrowHeld, released, disputed, vendorRows] = await Promise.all([
    prisma.booking.aggregate({
      where,
      _count: true,
      _sum: {
        totalInvoicePriceMinor: true,
        platformCommissionMinor: true,
        processingFeeMinor: true,
        providerPayoutMinor: true,
        tipMinor: true,
        trustFeeMinor: true,
        discountMinor: true,
      },
    }),
    prisma.booking.groupBy({
      by: ["source"],
      where,
      _count: true,
      _sum: { totalInvoicePriceMinor: true, platformCommissionMinor: true },
    }),
    prisma.booking.aggregate({
      where: { paymentStatus: "AUTHORISED" },
      _count: true,
      _sum: { totalInvoicePriceMinor: true },
    }),
    prisma.booking.aggregate({
      where: { ...where, paymentStatus: "ESCROW_RELEASED" },
      _count: true,
      _sum: { providerPayoutMinor: true },
    }),
    prisma.booking.aggregate({
      where: { settlementStatus: "DISPUTED" },
      _count: true,
      _sum: { totalInvoicePriceMinor: true },
    }),
    prisma.booking.groupBy({
      by: ["providerId"],
      where: { ...where, providerId: { not: null } },
      _count: true,
      _sum: { totalInvoicePriceMinor: true, platformCommissionMinor: true, providerPayoutMinor: true },
      orderBy: { _sum: { totalInvoicePriceMinor: "desc" } },
      take: 25,
    }),
  ]);

  const vendorIds = vendorRows.map((row) => row.providerId!).filter(Boolean);
  const vendors = await prisma.provider.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true, slug: true, payoutsEnabled: true },
  });
  const byId = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  return {
    bookings: totals._count,
    gmvMinor: totals._sum.totalInvoicePriceMinor ?? 0,
    commissionMinor: totals._sum.platformCommissionMinor ?? 0,
    processingFeesMinor: totals._sum.processingFeeMinor ?? 0,
    trustFeesMinor: totals._sum.trustFeeMinor ?? 0,
    vendorPayoutsMinor: totals._sum.providerPayoutMinor ?? 0,
    tipsMinor: totals._sum.tipMinor ?? 0,
    discountsMinor: totals._sum.discountMinor ?? 0,
    bySource: bySource.map((row) => ({
      source: row.source,
      bookings: row._count,
      gmvMinor: row._sum.totalInvoicePriceMinor ?? 0,
      commissionMinor: row._sum.platformCommissionMinor ?? 0,
    })),
    escrowHeld: { bookings: escrowHeld._count, amountMinor: escrowHeld._sum.totalInvoicePriceMinor ?? 0 },
    released: { bookings: released._count, amountMinor: released._sum.providerPayoutMinor ?? 0 },
    disputed: { bookings: disputed._count, amountMinor: disputed._sum.totalInvoicePriceMinor ?? 0 },
    vendors: vendorRows.map((row) => ({
      id: row.providerId!,
      name: byId.get(row.providerId!)?.name ?? "Unknown vendor",
      slug: byId.get(row.providerId!)?.slug ?? null,
      payoutsEnabled: byId.get(row.providerId!)?.payoutsEnabled ?? false,
      bookings: row._count,
      gmvMinor: row._sum.totalInvoicePriceMinor ?? 0,
      commissionMinor: row._sum.platformCommissionMinor ?? 0,
      payoutMinor: row._sum.providerPayoutMinor ?? 0,
    })),
  };
}
