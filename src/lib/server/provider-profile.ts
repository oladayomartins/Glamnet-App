import { prisma } from "./prisma";
import { addDays, startOfLocalDay, type ProviderSchedule } from "@/lib/domain/availability";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { isFreeTonight } from "./openings";

export interface ProviderProfile {
  id: string;
  name: string;
  bio: string;
  rating: number;
  reviewCount: number;
  completedBookings: number;
  hubId: string;
  hubName: string;
  city: string;
  sector: string;
  travelFeeMinor: number;
  /** Media-library photo. Empty until the vendor has uploaded one. */
  avatarUrl: string;
  freeTonight: boolean;
  /** Minutes from the earliest to the latest shift, per weekday. */
  workingDays: string[];
  services: {
    id: string;
    name: string;
    description: string;
    category: string;
    kind: string;
    priceMinor: number;
    durationMinutes: number;
  }[];
  reviews: {
    id: string;
    rating: number;
    note: string;
    at: Date;
    services: string[];
  }[];
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * The customer-facing vendor profile (§C-03).
 *
 * Only approved vendors who are taking work are returned. A profile for
 * someone the matching engine would never broadcast to is a page whose only
 * possible outcome is a dead end.
 */
export async function getProviderProfile(
  id: string,
  now = new Date(),
): Promise<ProviderProfile | null> {
  const dayStart = startOfLocalDay(now);
  const dayEnd = addDays(dayStart, 1);

  const provider = await prisma.provider.findFirst({
    where: { id, approvalStatus: "APPROVED", isAcceptingWork: true },
    select: {
      id: true,
      name: true,
      bio: true,
      rating: true,
      completedBookings: true,
      avatarUrl: true,
      hub: {
        select: {
          id: true,
          name: true,
          city: true,
          sector: true,
          travelFeeMinor: true,
        },
      },
      services: {
        select: {
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              kind: true,
              priceMinor: true,
              durationMinutes: true,
              isActive: true,
            },
          },
        },
      },
      availability: true,
      timeOff: { where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } } },
      bookings: {
        where: {
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: dayEnd },
          reservedUntilAt: { gt: dayStart },
        },
        select: { appointmentStartAt: true, reservedUntilAt: true },
      },
    },
  });

  if (!provider) return null;

  // Reviews are read separately: the calendar query above is scoped to today,
  // and reviews are the whole history.
  const reviewed = await prisma.booking.findMany({
    where: { providerId: id, rating: { not: null } },
    orderBy: { appointmentStartAt: "desc" },
    take: 10,
    select: {
      id: true,
      rating: true,
      reviewNote: true,
      appointmentStartAt: true,
      items: { select: { name: true } },
    },
  });

  const schedule: ProviderSchedule = {
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

  return {
    id: provider.id,
    name: provider.name,
    bio: provider.bio,
    rating: provider.rating,
    reviewCount: reviewed.length,
    completedBookings: provider.completedBookings,
    hubId: provider.hub.id,
    hubName: provider.hub.name,
    city: provider.hub.city,
    sector: provider.hub.sector,
    travelFeeMinor: provider.hub.travelFeeMinor,
    avatarUrl: provider.avatarUrl,
    freeTonight: isFreeTonight(schedule, now),
    workingDays: [
      ...new Set(provider.availability.map((window) => window.dayOfWeek)),
    ]
      .sort()
      .map((day) => WEEKDAYS[day]),
    services: provider.services
      .map((link) => link.service)
      .filter((service) => service.isActive)
      .sort(
        (a, b) =>
          a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      ),
    reviews: reviewed.map((booking) => ({
      id: booking.id,
      rating: booking.rating ?? 0,
      note: booking.reviewNote,
      at: booking.appointmentStartAt,
      services: booking.items.map((item) => item.name),
    })),
  };
}
