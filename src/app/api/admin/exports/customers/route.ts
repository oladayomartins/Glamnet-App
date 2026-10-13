import type { Prisma } from "@prisma/client";
import { adminCsvRoute } from "@/lib/server/admin/export-route";
import { MAX_EXPORT_ROWS, isoDate, pounds, toCsv } from "@/lib/server/admin/csv";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

const NOT_CANCELLED: Prisma.BookingWhereInput = { status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] } };

/** GET /api/admin/exports/customers?q=&suspended=1 — customers, with what they've booked and spent. */
export const GET = adminCsvRoute("customers", async (params) => {
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const suspendedOnly = params.get("suspended") === "1";
  const where: Prisma.CustomerWhereInput = {
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(suspendedOnly ? { appUser: { suspendedAt: { not: null } } } : {}),
  };
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
    include: { appUser: { select: { suspendedAt: true, suspendedReason: true, marketingOptOutAt: true } } },
  });
  const ids = customers.map((customer) => customer.id);
  // Postgres takes about 32k parameters per query, so a big export groups
  // every booking instead of naming each id.
  const scope = ids.length <= 5_000 ? { customerId: { in: ids } } : {};
  const [all, live, last] = await Promise.all([
    prisma.booking.groupBy({ by: ["customerId"], where: scope, _count: true, _sum: { refundedMinor: true } }),
    prisma.booking.groupBy({
      by: ["customerId"],
      where: { ...scope, ...NOT_CANCELLED },
      _count: true,
      _sum: { totalInvoicePriceMinor: true },
    }),
    prisma.booking.groupBy({ by: ["customerId"], where: scope, _max: { bookingCreatedAt: true } }),
  ]);
  const allBy = new Map(all.map((row) => [row.customerId, row]));
  const liveBy = new Map(live.map((row) => [row.customerId, row]));
  const lastBy = new Map(last.map((row) => [row.customerId, row._max.bookingCreatedAt]));

  const csv = toCsv(
    [
      "customer_id", "name", "email", "phone", "postcode", "joined_at", "has_login", "suspended", "suspended_reason",
      "marketing_opt_out", "bookings", "bookings_not_cancelled", "spent_gbp", "refunded_gbp", "last_booked_at",
    ],
    customers.map((c) => [
      c.id, c.name, c.email, c.phone, c.postcode, isoDate(c.createdAt), Boolean(c.appUser), Boolean(c.appUser?.suspendedAt),
      c.appUser?.suspendedReason ?? "", Boolean(c.appUser?.marketingOptOutAt), allBy.get(c.id)?._count ?? 0,
      liveBy.get(c.id)?._count ?? 0, pounds(liveBy.get(c.id)?._sum.totalInvoicePriceMinor),
      pounds(allBy.get(c.id)?._sum.refundedMinor), isoDate(lastBy.get(c.id)),
    ]),
  );
  return { csv, rows: customers.length, summary: [suspendedOnly && "suspended", q && `“${q}”`].filter(Boolean).join(", ") };
});
