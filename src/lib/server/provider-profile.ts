import { prisma } from "./prisma";
import { addMinutes, startOfLocalDay, type ProviderSchedule } from "@/lib/domain/availability";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { isFreeTonight, nextOpening, NEXT_OPENING_HORIZON_DAYS } from "./openings";
import { openUntil, weeklyHours, type DayHours } from "@/lib/domain/opening-hours";
import { summariseReputation, type Reputation } from "@/lib/domain/reputation";

export interface ProviderProfile {
  id: string;
  name: string;
  bio: string;
  /** What the storefront may claim about the rating — see reputation.ts. */
  reputation: Reputation;
  completedBookings: number;
  hubId: string;
  hubName: string;
  city: string;
  sector: string;
  travelFeeMinor: number;
  /** Media-library photo. Empty until the provider has uploaded one. */
  avatarUrl: string;
  freeTonight: boolean;
  /**
   * The first bookable hour, found through the same availability gate the slot
   * picker uses — so the storefront cannot advertise an opening booking would
   * refuse. Null when nothing opens up inside the horizon.
   */
  nextOpeningAt: Date | null;
  nextOpeningIsToday: boolean;
  /** "Open until 18:00" while a shift is in progress, else null. */
  openUntilLabel: string | null;
  /** The full working week, Monday first, for the About section. */
  weekHours: DayHours[];
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

/**
 * The customer-facing provider profile (§C-03).
 *
 * Only approved providers who are taking work are returned. A profile for
 * someone the matching engine would never broadcast to is a page whose only
 * possible outcome is a dead end.
 */
export async function getProviderProfile(
  id: string,
  now = new Date(),
): Promise<ProviderProfile | null> {
  const dayStart = startOfLocalDay(now);
  // "Next available" looks past today, so the calendar it reasons over has to
  // as well. Loading only today would let a fortnight of solid bookings read
  // as wide open.
  const horizonEnd = addMinutes(dayStart, NEXT_OPENING_HORIZON_DAYS * 24 * 60);

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
      timeOff: { where: { startAt: { lt: horizonEnd }, endAt: { gt: dayStart } } },
      bookings: {
        where: {
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: horizonEnd },
          reservedUntilAt: { gt: dayStart },
        },
        select: { appointmentStartAt: true, reservedUntilAt: true },
      },
    },
  });

  if (!provider) return null;

  // Reviews are read separately: the calendar query above is scoped to the
  // booking horizon, and reviews are the whole history.
  //
  // The count is its own query rather than `reviewed.length`. Reusing the
  // length capped every provider at "(10 reviews)" no matter how many they
  // really had — which is the opposite of the point, since the whole reason to
  // print a count is that it is the true one.
  const [reviewCount, reviewed] = await Promise.all([
    prisma.booking.count({ where: { providerId: id, rating: { not: null } } }),
    prisma.booking.findMany({
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
    }),
  ]);

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

  const opening = nextOpening(schedule, now);

  return {
    id: provider.id,
    name: provider.name,
    bio: provider.bio,
    reputation: summariseReputation(
      provider.rating,
      reviewCount,
      provider.completedBookings,
    ),
    completedBookings: provider.completedBookings,
    hubId: provider.hub.id,
    hubName: provider.hub.name,
    city: provider.hub.city,
    sector: provider.hub.sector,
    travelFeeMinor: provider.hub.travelFeeMinor,
    avatarUrl: provider.avatarUrl,
    freeTonight: isFreeTonight(schedule, now),
    nextOpeningAt: opening?.at ?? null,
    nextOpeningIsToday: opening?.isToday ?? false,
    openUntilLabel: openUntil(
      schedule.workingWindows,
      now.getDay(),
      now.getHours() * 60 + now.getMinutes(),
    ),
    weekHours: weeklyHours(schedule.workingWindows),
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
