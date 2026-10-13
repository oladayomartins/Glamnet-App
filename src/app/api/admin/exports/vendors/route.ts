import type { Prisma } from "@prisma/client";
import { adminCsvRoute } from "@/lib/server/admin/export-route";
import { MAX_EXPORT_ROWS, isoDate, pounds, toCsv } from "@/lib/server/admin/csv";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"];
const NOT_CANCELLED: Prisma.BookingWhereInput = { status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] } };

/** GET /api/admin/exports/vendors?status=&q= — vendors, as filtered on the Vendors page. */
export const GET = adminCsvRoute("vendors", async (params) => {
  const status = STATUSES.includes(params.get("status") ?? "") ? params.get("status")! : "";
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const where: Prisma.ProviderWhereInput = {
    ...(status ? { approvalStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const vendors = await prisma.provider.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
    include: {
      hub: { select: { name: true, sector: true, city: true } },
      appUser: { select: { suspendedAt: true } },
      documents: { select: { status: true, expiresAt: true } },
      _count: { select: { services: true } },
    },
  });
  const ids = vendors.map((vendor) => vendor.id);
  // Postgres takes about 32k parameters per query, so a big export groups
  // every booking instead of naming each id.
  const scope = ids.length <= 5_000 ? { providerId: { in: ids } } : {};
  const [all, live] = await Promise.all([
    prisma.booking.groupBy({ by: ["providerId"], where: scope, _count: true }),
    prisma.booking.groupBy({
      by: ["providerId"],
      where: { ...scope, ...NOT_CANCELLED },
      _count: true,
      _sum: { totalInvoicePriceMinor: true, providerPayoutMinor: true, platformCommissionMinor: true },
      _avg: { rating: true },
    }),
  ]);
  const allBy = new Map(all.map((row) => [row.providerId, row._count]));
  const liveBy = new Map(live.map((row) => [row.providerId, row]));
  const now = Date.now();

  const csv = toCsv(
    [
      "vendor_id", "name", "email", "phone", "storefront", "status", "featured", "accepting_work", "login_suspended",
      "city", "area", "sector", "workspace", "joined_at", "application_sent_at", "approved_at", "payouts_enabled",
      "services", "bookings", "bookings_not_cancelled", "booking_value_gbp", "vendor_payout_gbp", "commission_gbp",
      "average_rating", "documents", "documents_pending", "documents_expired",
    ],
    vendors.map((v) => {
      const stats = liveBy.get(v.id);
      return [
        v.id, v.name, v.email, v.phone, v.slug ? `/pro/${v.slug}` : "", v.approvalStatus, v.isFeatured, v.isAcceptingWork,
        Boolean(v.appUser?.suspendedAt), v.hub.city, v.hub.name, v.hub.sector, v.workspaceType, isoDate(v.createdAt),
        isoDate(v.onboardedAt), isoDate(v.approvedAt), v.payoutsEnabled, v._count.services, allBy.get(v.id) ?? 0,
        stats?._count ?? 0, pounds(stats?._sum.totalInvoicePriceMinor), pounds(stats?._sum.providerPayoutMinor),
        pounds(stats?._sum.platformCommissionMinor), stats?._avg.rating ? stats._avg.rating.toFixed(2) : "",
        v.documents.length, v.documents.filter((doc) => doc.status === "PENDING").length,
        v.documents.filter((doc) => doc.expiresAt && doc.expiresAt.getTime() < now).length,
      ];
    }),
  );
  return { csv, rows: vendors.length, summary: [status.toLowerCase(), q && `“${q}”`].filter(Boolean).join(", ") };
});
