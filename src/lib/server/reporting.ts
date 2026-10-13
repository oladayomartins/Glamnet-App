import { prisma } from "./prisma";

/** Every metric spec §10 asks the admin dashboard to report. */
export interface EmergencyReport {
  totalBookings: number;
  normalBookings: number;
  emergencyBookings: number;
  /** Emergency share of all bookings, as a percentage to one decimal place. */
  emergencyBookingPercentage: number;
  /** Gross invoice value of emergency bookings, in pence. */
  emergencyRevenueMinor: number;
  /** The surcharge component of that revenue, in pence. */
  emergencySurchargeRevenueMinor: number;
  normalRevenueMinor: number;
  emergencyProviderEarningsMinor: number;
  /** Broadcasts accepted / broadcasts sent, as a percentage. */
  providerAcceptanceRate: number;
  /** Mean minutes from broadcast to acceptance. */
  averageMinutesToAcceptance: number | null;
  emergencyCancellationRate: number;
  normalCancellationRate: number;
  /** Emergency bookings that reached COMPLETED or beyond, as a percentage. */
  emergencyFulfilmentRate: number;
}

const FULFILLED = ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"];

function percentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1_000) / 10;
}

/**
 * Compute the admin reporting figures.
 *
 * Aggregated in the database: one grouped sum over bookings by type and
 * status, and counts plus an average over broadcasts. This used to read every
 * booking and every broadcast row into memory on each visit to the Bookings
 * page, which grew with the business.
 */
export async function buildEmergencyReport(): Promise<EmergencyReport> {
  const [groups, broadcastsSent, broadcastsAccepted, acceptance] = await Promise.all([
    prisma.booking.groupBy({
      by: ["bookingType", "status"],
      _count: true,
      _sum: { totalInvoicePriceMinor: true, emergencySurchargeMinor: true, providerEarningsMinor: true },
    }),
    prisma.bookingBroadcast.count(),
    prisma.bookingBroadcast.count({ where: { status: "ACCEPTED" } }),
    prisma.$queryRaw<Array<{ minutes: number | null }>>`
      SELECT (AVG(EXTRACT(EPOCH FROM ("respondedAt" - "sentAt"))) / 60)::float8 AS minutes
      FROM "BookingBroadcast"
      WHERE "status" = 'ACCEPTED' AND "respondedAt" IS NOT NULL
    `,
  ]);

  const tally = (type: "EMERGENCY" | "NORMAL", statuses?: string[]) =>
    groups
      .filter((row) => row.bookingType === type && (!statuses || statuses.includes(row.status)))
      .reduce(
        (total, row) => ({
          count: total.count + row._count,
          revenueMinor: total.revenueMinor + (row._sum.totalInvoicePriceMinor ?? 0),
          surchargeMinor: total.surchargeMinor + (row._sum.emergencySurchargeMinor ?? 0),
          earningsMinor: total.earningsMinor + (row._sum.providerEarningsMinor ?? 0),
        }),
        { count: 0, revenueMinor: 0, surchargeMinor: 0, earningsMinor: 0 },
      );

  const totalBookings = groups.reduce((total, row) => total + row._count, 0);
  const emergency = tally("EMERGENCY");
  const normal = tally("NORMAL");
  const minutes = acceptance[0]?.minutes;

  return {
    totalBookings,
    normalBookings: normal.count,
    emergencyBookings: emergency.count,
    emergencyBookingPercentage: percentage(emergency.count, totalBookings),
    emergencyRevenueMinor: emergency.revenueMinor,
    emergencySurchargeRevenueMinor: emergency.surchargeMinor,
    normalRevenueMinor: normal.revenueMinor,
    emergencyProviderEarningsMinor: emergency.earningsMinor,
    providerAcceptanceRate: percentage(broadcastsAccepted, broadcastsSent),
    averageMinutesToAcceptance: minutes === null || minutes === undefined ? null : Math.round(Number(minutes) * 10) / 10,
    emergencyCancellationRate: percentage(tally("EMERGENCY", ["CANCELLED"]).count, emergency.count),
    normalCancellationRate: percentage(tally("NORMAL", ["CANCELLED"]).count, normal.count),
    emergencyFulfilmentRate: percentage(tally("EMERGENCY", FULFILLED).count, emergency.count),
  };
}
