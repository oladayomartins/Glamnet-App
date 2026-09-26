import { prisma } from "./prisma";
import type { ProviderSchedule } from "@/lib/domain/availability";
import type { MatchCandidate } from "@/lib/domain/matching";
import { BROADCAST_RADIUS_KM, boundingBox, distanceKm } from "@/lib/domain/postcode";

/**
 * Statuses that hold a vendor's calendar. A booking blocks time from the
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

/** Where a request is: the customer's Beauty Hub. */
export interface RequestArea {
  sector: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Load every vendor who covers `area` as a match candidate, with their working
 * windows, calendar reservations and blocked periods over `[from, to)`.
 *
 * "Covers" means based within BROADCAST_RADIUS_KM of the area, anywhere in
 * the UK — measured from the vendor's own base postcode, or their hub's
 * centre if they have not given one. An area without coordinates (a lookup
 * outage) falls back to vendors in the same outward code.
 *
 * Reservations use `reservedUntilAt`, which already includes the 15-minute
 * transition period, so every downstream availability check gets the buffer
 * for free.
 */
export async function loadCandidates(
  area: RequestArea,
  from: Date,
  to: Date,
): Promise<MatchCandidate[]> {
  const centre =
    area.latitude !== null && area.longitude !== null
      ? { lat: area.latitude, lng: area.longitude }
      : null;
  const box = centre ? boundingBox(centre, BROADCAST_RADIUS_KM) : null;

  const found = await prisma.provider.findMany({
    // Vetting is enforced here, in the matching query, rather than only being
    // hidden in the UI: an unapproved vendor must never be broadcast a job,
    // whatever route the request arrived by.
    where: {
      isAcceptingWork: true,
      approvalStatus: "APPROVED",
      ...(box
        ? {
            OR: [
              {
                latitude: { gte: box.minLat, lte: box.maxLat },
                longitude: { gte: box.minLng, lte: box.maxLng },
              },
              {
                latitude: null,
                hub: {
                  latitude: { gte: box.minLat, lte: box.maxLat },
                  longitude: { gte: box.minLng, lte: box.maxLng },
                },
              },
              { hub: { sector: area.sector } },
            ],
          }
        : { hub: { sector: area.sector } }),
    },
    include: {
      hub: { select: { sector: true, latitude: true, longitude: true } },
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

  // The box is square; the radius is round.
  const providers = found.filter((provider) => {
    if (!centre) return true;
    const lat = provider.latitude ?? provider.hub.latitude;
    const lng = provider.longitude ?? provider.hub.longitude;
    if (lat === null || lng === null) return provider.hub.sector === area.sector;
    return distanceKm(centre, { lat, lng }) <= BROADCAST_RADIUS_KM;
  });

  return providers.map((provider) => ({
    providerId: provider.id,
    sectors: [area.sector],
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

/** One vendor's schedule, for the vendor-facing calendar. */
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
