import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { errorResponse } from "@/lib/api/respond";
import { prisma } from "@/lib/server/prisma";
import { resolveRange } from "@/lib/server/admin/ranges";

export const dynamic = "force-dynamic";

/** A cell that a spreadsheet will not execute as a formula. */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const pounds = (minor: number) => (minor / 100).toFixed(2);

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
      include: { provider: { select: { name: true } }, customer: { select: { name: true } } },
    });

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
    const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="glamnet-bookings-${range.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
