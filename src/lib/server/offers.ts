import { prisma } from "./prisma";
import { normaliseAmenities } from "@/lib/domain/vendor-tags";
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
import { lookupPlace } from "./geo";
import { BROADCAST_RADIUS_KM, boundingBox, distanceKm, outwardCode } from "@/lib/domain/postcode";
import { matchServices } from "@/lib/domain/service-search";
import { LISTED_VENDOR } from "@/lib/domain/vendor-setup";

/** How far ahead an offer will look for a vendor's first free slot. */
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
   * The vendor's first genuinely free start, or null when they have nothing
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
  /**
   * A chosen day, as YYYY-MM-DD. Offers are then the first slot each vendor
   * has ON that day, and a vendor with nothing free that day drops out
   * entirely rather than being answered with a different day they did not ask
   * for. Notice — and so the emergency classification — is still measured
   * from now, never from the day picked: choosing next Tuesday does not make
   * a booking placed this minute a long-notice one.
   */
  date?: string;
  /**
   * A chosen start time, as an ISO instant. Offers are then the first slot
   * each vendor has AT OR AFTER it on that day — the customer picked a time
   * from a real grid, so a vendor free later the same day is still an answer,
   * and one free only earlier is not.
   */
  at?: string;
  /**
   * Amenity tags the vendor must have ALL of — "female-only *and* parking"
   * narrows, it does not widen. Unknown values are dropped before the query,
   * so a stale link cannot silently return nothing.
   */
  amenities?: string[];
}

/**
 * Bookable offers for a search (§C-02).
 *
 * The unit here is an offer, not a vendor: one person, one service, one real
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
  const place = location && outwardCode(location) ? await lookupPlace(location) : null;

  const now = new Date();
  const from = startOfLocalDay(now);
  const to = addDays(from, HORIZON_DAYS);

  // A requested day or time cannot pull an offer into the past, so the floor
  // is whichever is latest: this moment, the time asked for, or the start of
  // the day asked for.
  const wantedAmenities = normaliseAmenities(filters.amenities ?? []);

  const requestedAt = parseInstant(filters.at);
  const requestedDay = requestedAt
    ? startOfLocalDay(requestedAt)
    : parseDay(filters.date);
  const wanted = requestedAt ?? requestedDay;
  const floor = wanted && wanted > now ? wanted : now;

  const [providers, config] = await Promise.all([
    prisma.provider.findMany({
      where: {
        approvalStatus: "APPROVED",
        isAcceptingWork: true,
        ...locationWhere(location, place),
        ...(filters.minRating ? { rating: { gte: filters.minRating } } : {}),
        ...(wantedAmenities.length > 0
          ? { amenities: { hasEvery: wantedAmenities } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        rating: true,
        completedBookings: true,
        avatarUrl: true,
        latitude: true,
        longitude: true,
        hub: {
          select: { id: true, city: true, sector: true, travelFeeMinor: true, latitude: true, longitude: true },
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
  const offers: Offer[] = [];

  for (const provider of providers) {
    if (!withinReach(place, provider)) continue;
    const offered = provider.services
      .map((link) => link.service)
      .filter((service) => service.isActive && service.kind !== "ADDON");

    // What the customer asked for, or — with no query — the cheapest thing
    // this vendor does, so a bare search still shows a real offer rather
    // than an arbitrary one.
    const service = bestService(query, offered, provider.name);
    if (!service) continue;

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

    const startAt = earliestStart(schedule, service.durationMinutes, floor);
    if (!startAt) continue;

    // Asked for a specific day, answered with a different one: not an offer.
    if (requestedDay && startAt >= addDays(startOfLocalDay(floor), 1)) continue;

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

type Place = NonNullable<Awaited<ReturnType<typeof lookupPlace>>>;

/**
 * Where a search looks. A postcode (or outward code) searches by distance,
 * anywhere in the UK; anything else is matched as a town name.
 */
function locationWhere(location: string, place: Place | null) {
  if (place) {
    const box = boundingBox(place, BROADCAST_RADIUS_KM);
    return {
      OR: [
        { latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } },
        {
          latitude: null,
          hub: { latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } },
        },
        { hub: { sector: place.outcode } },
      ],
    };
  }
  if (!location) return {};
  return {
    hub: {
      OR: [
        { city: { contains: location, mode: "insensitive" as const } },
        { sector: { contains: location, mode: "insensitive" as const } },
        { name: { contains: location, mode: "insensitive" as const } },
      ],
    },
  };
}

/** The box is square; the radius is round. */
function withinReach(
  place: Place | null,
  provider: { latitude: number | null; longitude: number | null; hub: { sector: string; latitude: number | null; longitude: number | null } },
): boolean {
  if (!place) return true;
  const lat = provider.latitude ?? provider.hub.latitude;
  const lng = provider.longitude ?? provider.hub.longitude;
  return lat !== null && lng !== null
    ? distanceKm(place, { lat, lng }) <= BROADCAST_RADIUS_KM
    : provider.hub.sector === place.outcode;
}

interface SearchableService {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
}

/**
 * The service of this vendor's that best answers the query, or null.
 *
 * Uses the same understanding as the home page's suggestions
 * (lib/domain/service-search.ts) — plurals, everyday words like "nails" or
 * "plaits", filler like "I need" — so a search that offered a suggestion
 * doesn't then come back empty. The literal phrase still counts too (in a
 * description, or the vendor's own name). Best match first, cheapest on a
 * tie; with no query, the cheapest thing they do.
 */
export function bestService<T extends SearchableService>(query: string, offered: T[], providerName: string): T | null {
  if (offered.length === 0) return null;
  const cheapest = (list: T[]) => list.reduce((best, next) => (next.priceMinor < best.priceMinor ? next : best));
  const needle = query.trim().toLowerCase();
  if (!needle) return cheapest(offered);

  const scored = matchServices(needle, offered, offered.length);
  if (scored.length > 0) {
    const top = scored[0].score;
    return cheapest(scored.filter((match) => match.score === top).map((match) => match.service));
  }
  const literal = offered.filter(
    (service) =>
      service.name.toLowerCase().includes(needle) ||
      service.description.toLowerCase().includes(needle) ||
      service.category.toLowerCase().includes(needle),
  );
  if (literal.length > 0) return cheapest(literal);
  return providerName.toLowerCase().includes(needle) ? cheapest(offered) : null;
}

/** A listed vendor who isn't verified yet, matched to a search. */
export interface UnverifiedMatch {
  providerId: string;
  name: string;
  slug: string;
  avatarUrl: string;
  city: string;
  sector: string;
  serviceName: string;
  fromMinor: number;
}

/**
 * Vendors who match the search but aren't verified yet, for the "More
 * vendors" section under the results.
 *
 * The main results feed the broadcast, which only ever goes to verified
 * vendors. These are booked directly through their own storefront instead,
 * shown with their "Not verified" badge — so a search in their area for
 * what they do still finds them.
 */
export async function searchUnverifiedVendors(filters: Pick<OfferQuery, "query" | "location" | "amenities">): Promise<UnverifiedMatch[]> {
  const query = filters.query?.trim() ?? "";
  const location = filters.location?.trim() ?? "";
  const place = location && outwardCode(location) ? await lookupPlace(location) : null;
  const wantedAmenities = normaliseAmenities(filters.amenities ?? []);

  const providers = await prisma.provider.findMany({
    where: {
      ...LISTED_VENDOR,
      approvalStatus: "PENDING",
      isAcceptingWork: true,
      slug: { not: null },
      ...locationWhere(location, place),
      ...(wantedAmenities.length > 0 ? { amenities: { hasEvery: wantedAmenities } } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      avatarUrl: true,
      workspaceSector: true,
      latitude: true,
      longitude: true,
      hub: { select: { city: true, sector: true, latitude: true, longitude: true } },
      services: {
        select: {
          priceMinor: true,
          service: {
            select: { id: true, name: true, description: true, category: true, kind: true, priceMinor: true, isActive: true },
          },
        },
      },
    },
    take: 200,
  });

  const matches: UnverifiedMatch[] = [];
  for (const provider of providers) {
    if (!withinReach(place, provider)) continue;
    // The vendor's own price where they set one: they're booked directly.
    const offered = provider.services
      .filter((link) => link.service.isActive && link.service.kind !== "ADDON")
      .map((link) => ({ ...link.service, priceMinor: link.priceMinor ?? link.service.priceMinor }));
    const service = bestService(query, offered, provider.name);
    if (!service) continue;
    matches.push({
      providerId: provider.id,
      name: provider.name,
      slug: provider.slug!,
      avatarUrl: provider.avatarUrl,
      city: provider.hub.city,
      sector: provider.workspaceSector || provider.hub.sector,
      serviceName: service.name,
      fromMinor: service.priceMinor,
    });
  }
  return matches.sort((a, b) => a.fromMinor - b.fromMinor).slice(0, 12);
}

/**
 * Soonest first, which is the question a customer arriving from search is
 * actually asking. Rating breaks ties rather than leading it, so a slower
 * five-star vendor does not bury someone who is free this afternoon.
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
 * The first start this vendor can genuinely serve, looking day by day.
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

/** An ISO instant, or null if it is not one. */
function parseInstant(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A YYYY-MM-DD day as a local midnight, or null if it is not one.
 *
 * Anything unparseable is treated as no day at all rather than as an error:
 * the parameter arrives from a query string, and a mangled link should still
 * return the marketplace instead of a stack trace.
 */
function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
