import { adminCsvRoute } from "@/lib/server/admin/export-route";
import { bookingListWhere, parseBookingFilter } from "@/lib/server/admin/booking-filters";
import { MAX_EXPORT_ROWS, isoDate, pounds, toCsv } from "@/lib/server/admin/csv";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admin/exports/bookings?filter=&q= — the bookings list as filtered on screen. */
export const GET = adminCsvRoute("bookings", async (params) => {
  const filter = parseBookingFilter(params.get("filter"));
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const bookings = await prisma.booking.findMany({
    where: bookingListWhere(filter, q),
    orderBy: { bookingCreatedAt: "desc" },
    take: MAX_EXPORT_ROWS,
    include: {
      customer: { select: { name: true, email: true } },
      provider: { select: { name: true, email: true } },
      hub: { select: { city: true, sector: true } },
    },
  });
  const csv = toCsv(
    [
      "booking_id", "created_at", "appointment_at", "type", "status", "payment_status", "settlement_status", "source",
      "city", "sector", "customer", "customer_email", "vendor", "vendor_email", "total_gbp", "emergency_surcharge_gbp",
      "commission_gbp", "vendor_payout_gbp", "tip_gbp", "discount_gbp", "refunded_gbp", "recovered_from_vendor_gbp",
      "cancellation_fee_gbp", "cancelled_by", "cancelled_at", "rating",
    ],
    bookings.map((b) => [
      b.id, isoDate(b.bookingCreatedAt), isoDate(b.appointmentStartAt), b.bookingType, b.status, b.paymentStatus,
      b.settlementStatus, b.source, b.hub?.city ?? "", b.hub?.sector ?? b.sector, b.customer.name, b.customer.email,
      b.provider?.name ?? "", b.provider?.email ?? "", pounds(b.totalInvoicePriceMinor), pounds(b.emergencySurchargeMinor),
      pounds(b.platformCommissionMinor), pounds(b.providerPayoutMinor), pounds(b.tipMinor), pounds(b.discountMinor),
      pounds(b.refundedMinor), pounds(b.clawbackMinor), pounds(b.cancellationFeeMinor), b.cancelledBy, isoDate(b.cancelledAt),
      b.rating ?? "",
    ]),
  );
  return { csv, rows: bookings.length, summary: `${filter.toLowerCase()}${q ? `, “${q}”` : ""}` };
});
