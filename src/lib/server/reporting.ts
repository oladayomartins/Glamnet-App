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

function sumMinor(rows: { totalInvoicePriceMinor: number }[]): number {
  return rows.reduce((total, row) => total + row.totalInvoicePriceMinor, 0);
}

/**
 * Compute the admin reporting figures.
 *
 * Reads whole booking rows rather than aggregating in SQL: the dataset is small
 * for this build, and keeping the arithmetic in one readable place matters more
 * than query efficiency until volume justifies otherwise.
 */
export async function buildEmergencyReport(): Promise<EmergencyReport> {
  const bookings = await prisma.booking.findMany({
    select: {
      bookingType: true,
      status: true,
      totalInvoicePriceMinor: true,
      emergencySurchargeMinor: true,
      providerEarningsMinor: true,
      providerEmergencyEarningsMinor: true,
    },
  });

  const emergency = bookings.filter((row) => row.bookingType === "EMERGENCY");
  const normal = bookings.filter((row) => row.bookingType === "NORMAL");

  const broadcasts = await prisma.bookingBroadcast.findMany({
    select: { status: true, sentAt: true, respondedAt: true },
  });
  const accepted = broadcasts.filter((row) => row.status === "ACCEPTED");

  const acceptanceDurations = accepted
    .filter((row) => row.respondedAt !== null)
    .map((row) => (row.respondedAt!.getTime() - row.sentAt.getTime()) / 60_000);

  const averageMinutesToAcceptance =
    acceptanceDurations.length === 0
      ? null
      : Math.round(
          (acceptanceDurations.reduce((total, value) => total + value, 0) /
            acceptanceDurations.length) *
            10,
        ) / 10;

  const cancelled = (rows: typeof bookings) =>
    rows.filter((row) => row.status === "CANCELLED").length;

  return {
    totalBookings: bookings.length,
    normalBookings: normal.length,
    emergencyBookings: emergency.length,
    emergencyBookingPercentage: percentage(emergency.length, bookings.length),
    emergencyRevenueMinor: sumMinor(emergency),
    emergencySurchargeRevenueMinor: emergency.reduce(
      (total, row) => total + row.emergencySurchargeMinor,
      0,
    ),
    normalRevenueMinor: sumMinor(normal),
    emergencyProviderEarningsMinor: emergency.reduce(
      (total, row) => total + row.providerEarningsMinor,
      0,
    ),
    providerAcceptanceRate: percentage(accepted.length, broadcasts.length),
    averageMinutesToAcceptance,
    emergencyCancellationRate: percentage(cancelled(emergency), emergency.length),
    normalCancellationRate: percentage(cancelled(normal), normal.length),
    emergencyFulfilmentRate: percentage(
      emergency.filter((row) => FULFILLED.includes(row.status)).length,
      emergency.length,
    ),
  };
}
