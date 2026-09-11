import { prisma } from "./prisma";
import {
  addMinutes,
  startOfLocalDay,
  type ProviderSchedule,
} from "@/lib/domain/availability";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { hasOpeningToday, isFreeTonight } from "./openings";

export interface ProviderResult {
  id: string;
  name: string;
  bio: string;
  rating: number;
  reviewCount: number;
  completedBookings: number;
  hubId: string;
  city: string;
  sector: string;
  travelFeeMinor: number;
  /** Cheapest service this provider offers that matched the query. */
  fromMinor: number | null;
  vetted: boolean;
  availableToday: boolean;
  /** Free this evening specifically — what the `Free tonight` badge claims. */
  freeTonight: boolean;
  specialities: string[];
  /** The matching services, so the card can say what it matched on. */
  matchedServices: { id: string; name: string; priceMinor: number }[];
}

export interface ProviderSearchFilters {
  query?: string;
  location?: string;
  /** Maximum "from" price, in pence. */
  maxPriceMinor?: number;
  minRating?: number;
  availableToday?: boolean;
}

/**
 * Provider search (§C-02).
 *
 * The unit of a result is a provider, not a catalogue row: a customer is
 * choosing who comes to their door. A provider only appears when they are
 * approved, taking work, in the requested area and qualified for at least one
 * service matching the query — so every card on the results page leads to
 * something that can actually be booked.
 */
export async function searchProviders(
  filters: ProviderSearchFilters,
): Promise<ProviderResult[]> {
  const query = filters.query?.trim() ?? "";
  const location = filters.location?.trim() ?? "";

  const now = new Date();
  const dayStart = startOfLocalDay(now);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const providers = await prisma.provider.findMany({
    where: {
      approvalStatus: "APPROVED",
      isAcceptingWork: true,
      ...(location
        ? {
            hub: {
              OR: [
                { city: { contains: location, mode: "insensitive" } },
                { sector: { contains: location, mode: "insensitive" } },
                { name: { contains: location, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(filters.minRating ? { rating: { gte: filters.minRating } } : {}),
    },
    orderBy: [{ rating: "desc" }, { completedBookings: "desc" }],
    select: {
      id: true,
      name: true,
      bio: true,
      rating: true,
      completedBookings: true,
      hub: {
        select: { id: true, city: true, sector: true, travelFeeMinor: true },
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
      _count: { select: { bookings: { where: { rating: { not: null } } } } },
    },
  });

  const needle = query.toLowerCase();

  return providers
    .map((provider) => {
      const offered = provider.services
        .map((link) => link.service)
        .filter((service) => service.isActive);

      // The query is matched against the services a provider is actually
      // qualified for. Add-ons can match, but they never set the "from" price:
      // nobody books a lash application on its own.
      const matched = needle
        ? offered.filter(
            (service) =>
              service.name.toLowerCase().includes(needle) ||
              service.description.toLowerCase().includes(needle) ||
              service.category.toLowerCase().includes(needle) ||
              provider.name.toLowerCase().includes(needle),
          )
        : offered;

      const basePrices = matched
        .filter((service) => service.kind !== "ADDON")
        .map((service) => service.priceMinor);

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
        reviewCount: provider._count.bookings,
        completedBookings: provider.completedBookings,
        hubId: provider.hub.id,
        city: provider.hub.city,
        sector: provider.hub.sector,
        travelFeeMinor: provider.hub.travelFeeMinor,
        fromMinor: basePrices.length > 0 ? Math.min(...basePrices) : null,
        vetted: true,
        availableToday: hasOpeningToday(schedule, now),
        freeTonight: isFreeTonight(schedule, now),
        specialities: [...new Set(offered.map((service) => service.category))],
        matchedServices: matched.map((service) => ({
          id: service.id,
          name: service.name,
          priceMinor: service.priceMinor,
        })),
      } satisfies ProviderResult;
    })
    // Nothing bookable behind it is not a result.
    .filter((provider) => provider.matchedServices.length > 0)
    .filter((provider) =>
      filters.maxPriceMinor === undefined
        ? true
        : provider.fromMinor !== null &&
          provider.fromMinor <= filters.maxPriceMinor,
    )
    .filter((provider) => (filters.availableToday ? provider.availableToday : true));
}

/** Cities and sectors that currently have approved, working providers. */
export async function searchableAreas() {
  const hubs = await prisma.hub.findMany({
    where: {
      providers: { some: { approvalStatus: "APPROVED", isAcceptingWork: true } },
    },
    orderBy: { city: "asc" },
    select: { id: true, name: true, city: true, sector: true },
  });
  return hubs;
}

/**
 * The nearest area that does have cover, for the zero-results state (§S-02).
 * An empty page that only says "nothing found" is a dead end; this is what it
 * offers instead.
 */
export async function nearestCoveredArea(excludeLocation: string) {
  const areas = await searchableAreas();
  const excluded = excludeLocation.trim().toLowerCase();
  return (
    areas.find((area) => area.city.toLowerCase() !== excluded) ?? areas[0] ?? null
  );
}
