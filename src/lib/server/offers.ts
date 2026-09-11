import { prisma } from "./prisma";
import {
  addDays,
  buildSlotOptions,
  startOfLocalDay,
  type ProviderSchedule,
} from "@/lib/domain/availability";
import {
  classifyBooking,
  noticePeriodMinutes,
  resolveThresholdMinutes,
} from "@/lib/domain/classification";
import { priceBooking } from "@/lib/domain/pricing";
import type { BasketLine } from "@/lib/domain/types";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { getActiveEmergencyConfig } from "./emergency-config";

/** How far ahead an offer will look for a provider's first free slot. */
const HORIZON_DAYS = 7;

export interface Offer {
  providerId: string;
  providerName: string;
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  completedBookings: number;
  hubId: string;
  city: string;
  sector: string;
  travelFeeMinor: number;

  /** The service this offer is for — what the customer searched, priced. */
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  /** Duration plus the 15-minute transition, which is what is actually held. */
  reservedMinutes: number;

  /**
   * The provider's first genuinely free start, or null when they have nothing
   * inside the horizon. Null offers are dropped rather than shown as "ask" —
   * an offer nobody can act on is not an offer.
   */
  startAt: Date;
  noticeMinutes: number;
  bookingType: "NORMAL" | "EMERGENCY";

  /** The real total for that slot, surcharge included where one applies. */
  totalMinor: number;
  emergencySurchargeMinor: number;
}

export interface OfferQuery {
  query?: string;
  location?: string;
  maxPriceMinor?: number;
  minRating?: number;
  availableToday?: boolean;
}

/**
 * Bookable offers for a search (§C-02).
 *
 * The unit here is an offer, not a provider: one person, one service, one real
 * start time, and the price that time actually costs. That is a stronger thing
 * to put in front of a customer than "from £35" — it is the number they will
 * be asked to authorise, computed by the same pricing engine the booking uses,
 * including the emergency surcharge when their first free slot happens to fall
 * inside the window.
 *
 * Every figure comes from the server. The client renders offers; it never
 * works out a price or decides what is available.
 */
export async function searchOffers(filters: OfferQuery): Promise<Offer[]> {
  const query = filters.query?.trim() ?? "";
  const location = filters.location?.trim() ?? "";

  const now = new Date();
  const from = startOfLocalDay(now);
  const to = addDays(from, HORIZON_DAYS);

  const [providers, config] = await Promise.all([
    prisma.provider.findMany({
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
      select: {
        id: true,
        name: true,
        rating: true,
        completedBookings: true,
        avatarUrl: true,
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
                durationMinutes: true,
                isActive: true,
              },
            },
          },
        },
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
        _count: { select: { bookings: { where: { rating: { not: null } } } } },
      },
    }),
    getActiveEmergencyConfig(now),
  ]);

  const thresholdMinutes = resolveThresholdMinutes(config, now);
  const needle = query.toLowerCase();
  const offers: Offer[] = [];

  for (const provider of providers) {
    const offered = provider.services
      .map((link) => link.service)
      .filter((service) => service.isActive && service.kind !== "ADDON");

    // What the customer asked for, or — with no query — the cheapest thing
    // this provider does, so a bare search still shows a real offer rather
    // than an arbitrary one.
    const matched = needle
      ? offered.filter(
          (service) =>
            service.name.toLowerCase().includes(needle) ||
            service.description.toLowerCase().includes(needle) ||
            service.category.toLowerCase().includes(needle) ||
            provider.name.toLowerCase().includes(needle),
        )
      : offered;

    if (matched.length === 0) continue;

    const service = matched.reduce((cheapest, candidate) =>
      candidate.priceMinor < cheapest.priceMinor ? candidate : cheapest,
    );

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

    const startAt = earliestStart(schedule, service.durationMinutes, now);
    if (!startAt) continue;

    const notice = noticePeriodMinutes(now, startAt);
    const bookingType = classifyBooking(notice, thresholdMinutes);

    const basket: BasketLine[] = [
      {
        id: service.id,
        name: service.name,
        priceMinor: service.priceMinor,
        durationMinutes: service.durationMinutes,
        kind: "SERVICE",
      },
    ];

    // The same engine the booking uses, so the figure on the results page is
    // the figure at checkout rather than an estimate that moves.
    const price = priceBooking(
      {
        basket,
        bookingType,
        travelFeeMinor: provider.hub.travelFeeMinor,
        emergencyConfig: config,
      },
      now,
    );

    offers.push({
      providerId: provider.id,
      providerName: provider.name,
      avatarUrl: provider.avatarUrl,
      rating: provider.rating,
      reviewCount: provider._count.bookings,
      completedBookings: provider.completedBookings,
      hubId: provider.hub.id,
      city: provider.hub.city,
      sector: provider.hub.sector,
      travelFeeMinor: provider.hub.travelFeeMinor,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      reservedMinutes: service.durationMinutes + 15,
      startAt,
      noticeMinutes: notice,
      bookingType,
      totalMinor: price.totalMinor,
      emergencySurchargeMinor: price.emergencySurchargeMinor,
    });
  }

  const endOfToday = addDays(from, 1);

  return offers
    .filter((offer) =>
      filters.maxPriceMinor === undefined
        ? true
        : offer.totalMinor <= filters.maxPriceMinor,
    )
    .filter((offer) =>
      filters.availableToday ? offer.startAt < endOfToday : true,
    )
    .sort(compareOffers);
}

/**
 * Soonest first, which is the question a customer arriving from search is
 * actually asking. Rating breaks ties rather than leading it, so a slower
 * five-star provider does not bury someone who is free this afternoon.
 */
export function compareOffers(
  a: Pick<Offer, "startAt" | "rating" | "completedBookings">,
  b: Pick<Offer, "startAt" | "rating" | "completedBookings">,
): number {
  return (
    a.startAt.getTime() - b.startAt.getTime() ||
    b.rating - a.rating ||
    b.completedBookings - a.completedBookings
  );
}

/**
 * The first start this provider can genuinely serve, looking day by day.
 *
 * Uses the same gate as the customer's slot picker and the broadcast matcher —
 * working hours, existing reservations (which already carry the transition)
 * and blocked periods — so an offer can never propose a time the booking flow
 * would then refuse.
 */
export function earliestStart(
  schedule: ProviderSchedule,
  durationMinutes: number,
  now: Date,
): Date | null {
  for (let day = 0; day < HORIZON_DAYS; day += 1) {
    const slots = buildSlotOptions(
      addDays(startOfLocalDay(now), day),
      durationMinutes,
      [schedule],
      now,
    );
    if (slots.length > 0) return slots[0].startAt;
  }
  return null;
}
