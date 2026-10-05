import { prisma } from "./prisma";
import { EARNED_STATUSES, ledgerRowFor, type LedgerRow } from "@/lib/domain/ledger";

/**
 * One vendor's ledger over [from, to), by appointment date, newest first:
 * finished jobs, plus the late-cancellation and missed-appointment fees they
 * were paid. See domain/ledger.ts for what each column means.
 */
export async function vendorLedger(providerId: string, from: Date, to: Date): Promise<LedgerRow[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      providerId,
      appointmentStartAt: { gte: from, lt: to },
      OR: [
        { status: { in: EARNED_STATUSES } },
        { status: { in: ["CANCELLED", "NO_SHOW"] }, cancellationFeePayoutMinor: { gt: 0 } },
      ],
    },
    orderBy: { appointmentStartAt: "desc" },
    take: 10_000,
    select: {
      id: true,
      status: true,
      bookingType: true,
      source: true,
      appointmentStartAt: true,
      escrowReleasedAt: true,
      totalInvoicePriceMinor: true,
      tipMinor: true,
      platformCommissionMinor: true,
      processingFeeMinor: true,
      trustFeeMinor: true,
      providerPayoutMinor: true,
      providerEmergencyEarningsMinor: true,
      cancellationFeeMinor: true,
      cancellationFeePayoutMinor: true,
      clawbackMinor: true,
      customer: { select: { name: true } },
      items: { select: { name: true } },
    },
  });

  return bookings
    .map((booking) =>
      ledgerRowFor({
        ...booking,
        clientName: booking.customer.name,
        services: booking.items.map((item) => item.name),
      }),
    )
    .filter((row): row is LedgerRow => row !== null);
}
