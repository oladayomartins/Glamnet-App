import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Everything an admin needs about one person, on one page.
 *
 * Looked up by any of the three ids a person can have — their login
 * (AppUser), their customer profile or their vendor profile — because links
 * reach this page from all three, and a vendor seeded without a login still
 * needs a page.
 */

const NOT_CANCELLED: Prisma.BookingWhereInput = { status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] } };
const RECENT = 25;

const bookingRow = {
  id: true,
  status: true,
  paymentStatus: true,
  settlementStatus: true,
  bookingType: true,
  appointmentStartAt: true,
  bookingCreatedAt: true,
  totalInvoicePriceMinor: true,
  providerPayoutMinor: true,
  refundedMinor: true,
  rating: true,
  customer: { select: { id: true, name: true } },
  provider: { select: { id: true, name: true } },
} satisfies Prisma.BookingSelect;

export type AccountBooking = Prisma.BookingGetPayload<{ select: typeof bookingRow }>;

async function resolveIds(id: string) {
  const login = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, customer: { select: { id: true } }, provider: { select: { id: true } } },
  });
  if (login) return { appUserId: login.id, customerId: login.customer?.id ?? null, providerId: login.provider?.id ?? null };

  const [provider, customer] = await Promise.all([
    prisma.provider.findUnique({ where: { id }, select: { id: true, appUserId: true } }),
    prisma.customer.findUnique({ where: { id }, select: { id: true, appUserId: true } }),
  ]);
  const appUserId = provider?.appUserId ?? customer?.appUserId ?? null;
  if (appUserId) return resolveIds(appUserId);
  if (provider) return { appUserId: null, customerId: null, providerId: provider.id };
  if (customer) return { appUserId: null, customerId: customer.id, providerId: null };
  return null;
}

/** Booking counts and money for one side of the marketplace. */
async function bookingStats(where: Prisma.BookingWhereInput) {
  const [byStatus, money, disputes, refunds] = await Promise.all([
    prisma.booking.groupBy({ by: ["status"], where, _count: true }),
    prisma.booking.aggregate({
      where: { ...where, ...NOT_CANCELLED },
      _sum: { totalInvoicePriceMinor: true, providerPayoutMinor: true, platformCommissionMinor: true },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.booking.count({ where: { ...where, OR: [{ status: "DISPUTED" }, { settlementStatus: { in: ["DISPUTED", "RESOLVED"] } }] } }),
    prisma.booking.aggregate({ where: { ...where, refundedMinor: { gt: 0 } }, _sum: { refundedMinor: true } }),
  ]);
  const count = (statuses: string[]) =>
    byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count, 0);
  return {
    total: byStatus.reduce((sum, row) => sum + row._count, 0),
    completed: count(["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"]),
    upcoming: count(["REQUESTED", "BROADCAST", "ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED", "PROVIDER_EN_ROUTE", "ARRIVED", "IN_PROGRESS"]),
    cancelled: count(["CANCELLED", "EXPIRED"]),
    noShows: count(["NO_SHOW"]),
    disputes,
    valueMinor: money._sum.totalInvoicePriceMinor ?? 0,
    payoutMinor: money._sum.providerPayoutMinor ?? 0,
    commissionMinor: money._sum.platformCommissionMinor ?? 0,
    refundedMinor: refunds._sum.refundedMinor ?? 0,
    averageRating: money._avg.rating,
    ratings: money._count.rating,
  };
}

export async function accountDetail(id: string) {
  const ids = await resolveIds(id);
  if (!ids) return null;

  const [login, customer, provider] = await Promise.all([
    ids.appUserId
      ? prisma.appUser.findUnique({
          where: { id: ids.appUserId },
          include: { _count: { select: { pushSubscriptions: true } } },
        })
      : null,
    ids.customerId
      ? prisma.customer.findUnique({
          where: { id: ids.customerId },
          include: { _count: { select: { saved: true } } },
        })
      : null,
    ids.providerId
      ? prisma.provider.findUnique({
          where: { id: ids.providerId },
          include: {
            hub: { select: { name: true, sector: true, city: true } },
            documents: { orderBy: { uploadedAt: "desc" } },
            services: {
              include: { service: { select: { name: true, category: true, priceMinor: true } } },
              orderBy: { service: { name: "asc" } },
            },
            _count: { select: { savedBy: true, lookbook: true, availability: true } },
          },
        })
      : null,
  ]);

  const targetIds = [ids.appUserId, ids.customerId, ids.providerId].filter((value): value is string => Boolean(value));
  const [asCustomer, asVendor, customerBookings, vendorBookings, promoUses, history] = await Promise.all([
    customer ? bookingStats({ customerId: customer.id }) : null,
    provider ? bookingStats({ providerId: provider.id }) : null,
    customer
      ? prisma.booking.findMany({ where: { customerId: customer.id }, orderBy: { bookingCreatedAt: "desc" }, take: RECENT, select: bookingRow })
      : [],
    provider
      ? prisma.booking.findMany({ where: { providerId: provider.id }, orderBy: { bookingCreatedAt: "desc" }, take: RECENT, select: bookingRow })
      : [],
    customer
      ? prisma.promoRedemption.findMany({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { promoCode: { select: { code: true } } },
        })
      : [],
    prisma.adminAuditLog.findMany({
      where: { targetId: { in: targetIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    ids,
    login,
    customer,
    provider,
    asCustomer,
    asVendor,
    customerBookings,
    vendorBookings,
    promoUses,
    history,
  };
}

export type AccountDetail = NonNullable<Awaited<ReturnType<typeof accountDetail>>>;
