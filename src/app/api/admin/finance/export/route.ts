import { requireApiRole } from "@/lib/auth/api-guard";
import { errorResponse } from "@/lib/api/respond";
import { prisma } from "@/lib/server/prisma";
import { resolveRange } from "@/lib/server/admin/ranges";
import { audit } from "@/lib/server/admin/core";
import { MAX_EXPORT_ROWS, csvResponse, pounds, toCsv } from "@/lib/server/admin/csv";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance/export?range=month — the booking ledger for a period
 * as CSV, one row per booking, for the accountant.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const range = resolveRange(new URL(request.url).searchParams.get("range") ?? undefined);
    const bookings = await prisma.booking.findMany({
      where: { bookingCreatedAt: { gte: range.from, lt: range.to } },
      orderBy: { bookingCreatedAt: "asc" },
      take: MAX_EXPORT_ROWS,
      include: { provider: { select: { name: true } }, customer: { select: { name: true } } },
    });

    // Customer names leave the platform in this file: record who took it.
    await audit(auth.user.email, "finance.export", { type: "Booking" }, `${bookings.length} bookings, ${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`);

    const header = [
      "booking_id", "created_at", "appointment_at", "status", "payment_status", "settlement_status",
      "source", "vendor", "customer", "total_gbp", "commission_gbp", "commission_rate_pct",
      "card_fee_gbp", "tip_gbp", "promo_discount_gbp", "charged_gbp", "vendor_payout_gbp", "escrow_released_at",
    ];
    const rows = bookings.map((b) => [
      b.id, b.bookingCreatedAt.toISOString(), b.appointmentStartAt.toISOString(), b.status, b.paymentStatus,
      b.settlementStatus, b.source, b.provider?.name ?? "", b.customer.name, pounds(b.totalInvoicePriceMinor),
      pounds(b.platformCommissionMinor), (b.commissionBps / 100).toFixed(2), pounds(b.processingFeeMinor),
      pounds(b.tipMinor), pounds(b.discountMinor), pounds(b.totalInvoicePriceMinor + b.tipMinor - b.discountMinor),
      pounds(b.providerPayoutMinor), b.escrowReleasedAt?.toISOString() ?? "",
    ]);
    return csvResponse(`bookings-${range.key}`, toCsv(header, rows));
  } catch (error) {
    return errorResponse(error);
  }
}
