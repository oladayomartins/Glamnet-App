import { prisma } from "./prisma";
import type { ProviderSchedule } from "@/lib/domain/availability";
import type { MatchCandidate } from "@/lib/domain/matching";

/**
 * Statuses that hold a provider's calendar. A booking blocks time from the
 * moment it is accepted right through to payout; only cancelled, expired and
 * still-broadcasting requests leave the slot free.
 */
export const CALENDAR_HOLDING_STATUSES = [
  "ACCEPTED",
  "CONFIRMED",
  "ADDRESS_UNLOCKED",
  "PROVIDER_EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REVIEWED",
  "PAYMENT_RELEASED",
] as const;

/**
 * Load every provider in `sector` as a match candidate, with their working
 * windows, calendar reservations and blocked periods over `[from, to)`.
 *
 * Reservations use `reservedUntilAt`, which already includes the 15-minute
 * transition period, so every downstream availability check gets the buffer
 * for free.
 */
export async function loadCandidates(
  sector: string,
  from: Date,
  to: Date,
): Promise<MatchCandidate[]> {
  const providers = await prisma.provider.findMany({
    // Vetting is enforced here, in the matching query, rather than only being
    // hidden in the UI: an unapproved provider must never be broadcast a job,
    // whatever route the request arrived by.
    where: {
      isAcceptingWork: true,
      approvalStatus: "APPROVED",
      hub: { sector },
    },
    include: {
      availability: true,
      services: true,
      timeOff: {
        where: { startAt: { lt: to }, endAt: { gt: from } },
      },
      bookings: {
        where: {
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: to },
          reservedUntilAt: { gt: from },
        },
        select: { appointmentStartAt: true, reservedUntilAt: true },
      },
    },
  });

  return providers.map((provider) => ({
    providerId: provider.id,
    sectors: [sector],
    serviceIds: provider.services.map((link) => link.serviceId),
    rating: provider.rating,
    completedBookings: provider.completedBookings,
    schedule: {
      providerId: provider.id,
      workingWindows: provider.availability.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
      reservations: provider.bookings.map((booking) => ({
        startAt: booking.appointmentStartAt,
        endAt: booking.reservedUntilAt,
      })),
      blocks: provider.timeOff.map((block) => ({
        startAt: block.startAt,
        endAt: block.endAt,
      })),
    } satisfies ProviderSchedule,
  }));
}

/** One provider's schedule, for the provider-facing calendar. */
export async function loadProviderSchedule(
  providerId: string,
  from: Date,
  to: Date,
): Promise<ProviderSchedule | null> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      availability: true,
      timeOff: { where: { startAt: { lt: to }, endAt: { gt: from } } },
      bookings: {
        where: {
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: to },
          reservedUntilAt: { gt: from },
        },
        select: { appointmentStartAt: true, reservedUntilAt: true },
      },
    },
  });

  if (!provider) return null;

  return {
    providerId: provider.id,
    workingWindows: provider.availability.map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    })),
    reservations: provider.bookings.map((booking) => ({
      startAt: booking.appointmentStartAt,
      endAt: booking.reservedUntilAt,
    })),
    blocks: provider.timeOff.map((block) => ({
      startAt: block.startAt,
      endAt: block.endAt,
    })),
  };
}
