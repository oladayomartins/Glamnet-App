import { prisma } from "./prisma";
import { addDays, startOfLocalDay, startOfWeek } from "@/lib/domain/availability";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";

/** The three figures a vendor checks before anything else (§P-01). */
export interface ProviderToday {
  isAcceptingWork: boolean;
  /** The next job that has not started yet, or null. */
  nextJob: {
    bookingId: string;
    bookingType: string;
    startAt: string;
    customerName: string;
    sector: string;
    services: string[];
  } | null;
  /** Earnings from today's jobs, in pence. */
  todayEarningsMinor: number;
  todayJobCount: number;
  /** Earnings from this week's jobs (Monday to Sunday), in pence. */
  weekEarningsMinor: number;
  weekJobCount: number;
  /**
   * Broadcasts accepted over broadcasts received, as a percentage, or null
   * when they have never been sent one — 0% would read as a judgement on a
   * vendor who has simply never been asked.
   */
  acceptanceRate: number | null;
}

export async function getProviderToday(
  providerId: string,
  now = new Date(),
): Promise<ProviderToday | null> {
  const dayStart = startOfLocalDay(now);
  const dayEnd = addDays(dayStart, 1);
  // Weeks start on Monday, as a UK diary does.
  const weekStart = startOfWeek(dayStart);
  const weekEnd = addDays(weekStart, 7);

  const [provider, weeksJobs, nextJob, broadcasts] = await Promise.all([
    prisma.provider.findUnique({
      where: { id: providerId },
      select: { isAcceptingWork: true },
    }),
    prisma.booking.findMany({
      where: {
        providerId,
        status: { in: [...CALENDAR_HOLDING_STATUSES] },
        appointmentStartAt: { gte: weekStart, lt: weekEnd },
      },
      select: { providerEarningsMinor: true, appointmentStartAt: true },
    }),
    prisma.booking.findFirst({
      where: {
        providerId,
        status: { in: [...CALENDAR_HOLDING_STATUSES] },
        appointmentStartAt: { gte: now },
      },
      orderBy: { appointmentStartAt: "asc" },
      select: {
        id: true,
        bookingType: true,
        appointmentStartAt: true,
        sector: true,
        customer: { select: { name: true } },
        items: { select: { name: true } },
      },
    }),
    prisma.bookingBroadcast.findMany({
      where: { providerId },
      select: { status: true },
    }),
  ]);

  if (!provider) return null;

  const todaysJobs = weeksJobs.filter(
    (job) => job.appointmentStartAt >= dayStart && job.appointmentStartAt < dayEnd,
  );
  const accepted = broadcasts.filter((row) => row.status === "ACCEPTED").length;

  return {
    isAcceptingWork: provider.isAcceptingWork,
    nextJob: nextJob
      ? {
          bookingId: nextJob.id,
          bookingType: nextJob.bookingType,
          startAt: nextJob.appointmentStartAt.toISOString(),
          customerName: nextJob.customer.name,
          sector: nextJob.sector,
          services: nextJob.items.map((item) => item.name),
        }
      : null,
    todayEarningsMinor: todaysJobs.reduce(
      (total, job) => total + job.providerEarningsMinor,
      0,
    ),
    todayJobCount: todaysJobs.length,
    weekEarningsMinor: weeksJobs.reduce(
      (total, job) => total + job.providerEarningsMinor,
      0,
    ),
    weekJobCount: weeksJobs.length,
    acceptanceRate:
      broadcasts.length === 0
        ? null
        : Math.round((accepted / broadcasts.length) * 100),
  };
}
