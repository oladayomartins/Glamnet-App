import { prisma } from "./prisma";
import { BookingError, settlementFields } from "./booking-service";
import { getActiveEmergencyConfig } from "./emergency-config";
import { CALENDAR_HOLDING_STATUSES, loadProviderSchedule } from "./schedules";
import { paymentGateway, type Authorisation } from "./payments";
import { hasPriorBooking } from "./escrow";
import {
  addDays,
  addMinutes,
  buildDayGrid,
  isProviderAvailable,
  reservationWindow,
  startOfLocalDay,
} from "@/lib/domain/availability";
import {
  basketDurationMinutes,
  classifyBooking,
  noticePeriodMinutes,
  resolveThresholdMinutes,
} from "@/lib/domain/classification";
import { priceBooking } from "@/lib/domain/pricing";
import { decideCommission, type BookingSource } from "@/lib/domain/settlement";
import { TRANSITION_BUFFER_MINUTES } from "@/lib/domain/constants";
import type { BasketLine, ServiceLocation } from "@/lib/domain/types";
import { byDistance, sectorDistanceKm } from "@/lib/domain/postcode";
import { crossSellFor, type CrossSellCandidate } from "@/lib/domain/specialty-hubs";

/**
 * Vendor storefronts and the direct booking engine (Open Marketplace
 * Directory §A–§B, Flow 1).
 *
 * Unlike the emergency broadcast, a storefront booking names its vendor: the
 * client picks a person, a basket from that person's own menu and prices,
 * and an hour from that person's own calendar. No other vendor is involved.
 */

/** How long an unpaid checkout may hold a slot before it is released. */
export const CHECKOUT_HOLD_MINUTES = 30;

/** Only these vendors have a live storefront and booking calendar. */
const LIVE_VENDOR = {
  approvalStatus: "APPROVED",
  isVerified: true,
  isAcceptingWork: true,
  slug: { not: null },
} as const;

export interface StorefrontService {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "SERVICE" | "ADDON";
  priceMinor: number;
  durationMinutes: number;
}

export function workspaceLabel(type: string): string {
  switch (type) {
    case "HOME_SALON":
      return "Home salon";
    case "PRIVATE_ROOM":
      return "Private room";
    case "CHAIR":
      return "Independent chair";
    default:
      return "Mobile only";
  }
}

/** The vendor's own menu: their price and duration, else the catalogue's. */
function menuFrom(
  links: {
    priceMinor: number | null;
    durationMinutes: number | null;
    service: {
      id: string;
      name: string;
      description: string;
      category: string;
      kind: string;
      priceMinor: number;
      durationMinutes: number;
      isActive: boolean;
    };
  }[],
): StorefrontService[] {
  return links
    .filter((link) => link.service.isActive)
    .map((link) => ({
      id: link.service.id,
      name: link.service.name,
      description: link.service.description,
      category: link.service.category,
      kind: link.service.kind === "ADDON" ? ("ADDON" as const) : ("SERVICE" as const),
      priceMinor: link.priceMinor ?? link.service.priceMinor,
      durationMinutes: link.durationMinutes ?? link.service.durationMinutes,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

const SERVICE_SELECT = {
  priceMinor: true,
  durationMinutes: true,
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
} as const;

export async function getStorefront(slug: string) {
  const provider = await prisma.provider.findFirst({
    where: { ...LIVE_VENDOR, slug },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      rating: true,
      completedBookings: true,
      avatarUrl: true,
      instagramHandle: true,
      tiktokHandle: true,
      workspaceType: true,
      workspaceSector: true,
      travelsToClients: true,
      hub: { select: { id: true, city: true, sector: true, travelFeeMinor: true } },
      lookbook: { orderBy: { position: "asc" }, take: 3 },
      services: { select: SERVICE_SELECT },
    },
  });
  if (!provider || !provider.slug) return null;

  // Un-editable review log: read from the bookings themselves, newest first.
  const reviews = await prisma.booking.findMany({
    where: { providerId: provider.id, rating: { not: null } },
    orderBy: { appointmentStartAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      reviewNote: true,
      appointmentStartAt: true,
      items: { select: { name: true } },
    },
  });

  const menu = menuFrom(provider.services);

  // Nail overlays from nearby vendors, for the bridal cross-sell when this
  // vendor does no nails themselves.
  const nearbyNails = menu.some((service) => service.category === "Manicures & Pedicures")
    ? []
    : await prisma.provider.findMany({
        where: {
          ...LIVE_VENDOR,
          id: { not: provider.id },
          hub: { city: provider.hub.city },
          services: { some: { service: { category: "Manicures & Pedicures", isActive: true } } },
        },
        select: { name: true, slug: true },
        take: 3,
      });

  return {
    ...provider,
    sector: provider.workspaceSector || provider.hub.sector,
    menu,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating ?? 0,
      note: review.reviewNote,
      at: review.appointmentStartAt,
      services: review.items.map((item) => item.name),
    })),
    nearbyNails: nearbyNails.map((vendor) => ({ name: vendor.name, slug: vendor.slug ?? "" })),
  };
}

export type Storefront = NonNullable<Awaited<ReturnType<typeof getStorefront>>>;

/** Bridal cross-sell for a storefront basket, from the vendor's own menu. */
export function storefrontCrossSell(
  menu: StorefrontService[],
  basketIds: string[],
): CrossSellCandidate[] {
  const basket = menu.filter((service) => basketIds.includes(service.id));
  return crossSellFor(
    basket.map((service) => service.category),
    menu,
    basketIds,
  );
}

/**
 * Release slots held by checkouts that were never paid. Without this, an
 * abandoned card form would block the vendor's calendar indefinitely.
 */
export async function releaseAbandonedCheckouts(providerId: string, now = new Date()) {
  const stale = await prisma.booking.findMany({
    where: {
      providerId,
      status: "ACCEPTED",
      source: { not: "BROADCAST" },
      paymentStatus: "PENDING_AUTHORISATION",
      bookingCreatedAt: { lt: addMinutes(now, -CHECKOUT_HOLD_MINUTES) },
    },
    select: { id: true },
  });
  if (stale.length === 0) return;
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { id: { in: stale.map((booking) => booking.id) }, status: "ACCEPTED" },
      data: { status: "EXPIRED", paymentStatus: "VOIDED" },
    }),
    prisma.bookingStatusEvent.createMany({
      data: stale.map((booking) => ({
        bookingId: booking.id,
        fromStatus: "ACCEPTED",
        toStatus: "EXPIRED",
        actor: "SYSTEM",
        note: `Card not authorised within ${CHECKOUT_HOLD_MINUTES} minutes.`,
      })),
    }),
  ]);
}

async function loadMenuFor(providerId: string, serviceIds: string[]) {
  const provider = await prisma.provider.findFirst({
    where: { id: providerId, ...LIVE_VENDOR },
    select: {
      id: true,
      name: true,
      workspaceType: true,
      workspaceSector: true,
      travelsToClients: true,
      hub: { select: { id: true, sector: true, travelFeeMinor: true } },
      services: {
        where: { serviceId: { in: serviceIds } },
        select: SERVICE_SELECT,
      },
    },
  });
  if (!provider) throw new BookingError("This storefront is not taking bookings.", "NO_PROVIDER", 404);

  const menu = menuFrom(provider.services);
  if (menu.length !== new Set(serviceIds).size) {
    throw new BookingError("One or more services are not on this menu.", "UNKNOWN_SERVICE");
  }
  if (!menu.some((service) => service.kind === "SERVICE")) {
    throw new BookingError("Add at least one service, not only add-ons.", "EMPTY_BASKET");
  }
  return { provider, menu };
}

/** Bookable start times on one day for one vendor and one basket. */
export async function storefrontSlots(
  providerId: string,
  serviceIds: string[],
  date: Date,
  now = new Date(),
) {
  const { menu } = await loadMenuFor(providerId, serviceIds);
  await releaseAbandonedCheckouts(providerId, now);

  const duration = menu.reduce((total, service) => total + service.durationMinutes, 0);
  const dayStart = startOfLocalDay(date);
  const schedule = await loadProviderSchedule(providerId, dayStart, addDays(dayStart, 2));
  if (!schedule) return { serviceDurationMinutes: duration, slots: [] };

  const config = await getActiveEmergencyConfig(now);
  const threshold = resolveThresholdMinutes(config, now);

  return {
    serviceDurationMinutes: duration,
    slots: buildDayGrid(dayStart, duration, [schedule], now).map((slot) => {
      const notice = noticePeriodMinutes(now, slot.startAt);
      return {
        startAt: slot.startAt.toISOString(),
        available: slot.availableProviderIds.length > 0,
        bookingType: classifyBooking(notice, threshold),
      };
    }),
  };
}

export interface StorefrontCheckoutRequest {
  providerId: string;
  customerId: string;
  customerEmail: string;
  serviceIds: string[];
  appointmentStartAt: Date;
  source: Extract<BookingSource, "MARKETPLACE" | "DIRECT_LINK">;
  serviceLocation: ServiceLocation;
  tipMinor: number;
  addressLine?: string;
  notes?: string;
}

/** The priced basket for a storefront checkout, before anything is written. */
export async function quoteStorefront(
  request: Omit<StorefrontCheckoutRequest, "customerEmail">,
  now = new Date(),
) {
  const { provider, menu } = await loadMenuFor(request.providerId, request.serviceIds);

  if (request.appointmentStartAt.getTime() <= now.getTime()) {
    throw new BookingError("Choose an appointment time in the future.", "PAST_APPOINTMENT");
  }
  if (request.serviceLocation === "VENDOR_PREMISES" && provider.workspaceType === "MOBILE") {
    throw new BookingError(`${provider.name} does not have a workspace to visit.`, "INVALID_TRANSITION");
  }
  if (request.serviceLocation === "CUSTOMER_ADDRESS" && !provider.travelsToClients) {
    throw new BookingError(`${provider.name} does not travel to clients.`, "INVALID_TRANSITION");
  }

  const basket: BasketLine[] = menu.map((service) => ({
    id: service.id,
    name: service.name,
    priceMinor: service.priceMinor,
    durationMinutes: service.durationMinutes,
    kind: service.kind,
  }));

  const config = await getActiveEmergencyConfig(now);
  const threshold = resolveThresholdMinutes(config, now);
  const notice = noticePeriodMinutes(now, request.appointmentStartAt);
  const bookingType = classifyBooking(notice, threshold);
  const duration = basketDurationMinutes(basket);

  const price = priceBooking(
    {
      basket,
      bookingType,
      // Nobody travels to a booking at the vendor's own workspace.
      travelFeeMinor:
        request.serviceLocation === "CUSTOMER_ADDRESS" ? provider.hub.travelFeeMinor : 0,
      emergencyConfig: config,
    },
    now,
  );

  const commission = decideCommission({
    source: request.source,
    hasPriorBooking: await hasPriorBooking(request.customerId, provider.id),
  });

  return {
    provider,
    basket,
    bookingType,
    notice,
    threshold,
    duration,
    price,
    commission,
    settlement: settlementFields(price, commission, request.tipMinor),
  };
}

/**
 * Place a storefront booking and its card hold.
 *
 * The slot check and the insert run under a per-vendor advisory lock, so two
 * clients racing for the same hour cannot both get it: the second waits,
 * then sees the first booking and is refused.
 */
export async function createStorefrontBooking(
  request: StorefrontCheckoutRequest,
  now = new Date(),
): Promise<{ bookingId: string; authorisation: Authorisation }> {
  await releaseAbandonedCheckouts(request.providerId, now);
  const quote = await quoteStorefront(request, now);
  const window = reservationWindow(request.appointmentStartAt, quote.duration);

  const booking = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.providerId}))`;

      const schedule = await loadProviderSchedule(request.providerId, window.startAt, window.endAt);
      const conflict = await tx.booking.findFirst({
        where: {
          providerId: request.providerId,
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: window.endAt },
          reservedUntilAt: { gt: window.startAt },
        },
        select: { id: true },
      });
      if (
        !schedule ||
        conflict ||
        !isProviderAvailable(schedule, request.appointmentStartAt, quote.duration)
      ) {
        throw new BookingError(
          "That time has just been taken. Please choose another.",
          "ALREADY_TAKEN",
          409,
        );
      }

      const sector = quote.provider.workspaceSector || quote.provider.hub.sector;
      return tx.booking.create({
        data: {
          bookingType: quote.bookingType,
          bookingCreatedAt: now,
          appointmentStartAt: request.appointmentStartAt,
          noticePeriodMinutes: quote.notice,
          thresholdMinutesUsed: quote.threshold,
          serviceDurationMinutes: quote.duration,
          reservedDurationMinutes: quote.duration + TRANSITION_BUFFER_MINUTES,
          reservedUntilAt: window.endAt,
          subtotalMinor: quote.price.subtotalMinor,
          travelFeeMinor: quote.price.travelFeeMinor,
          emergencySurchargeMinor: quote.price.emergencySurchargeMinor,
          otherSurchargesMinor: quote.price.otherSurchargesMinor,
          trustFeeMinor: quote.price.trustFeeMinor,
          totalInvoicePriceMinor: quote.price.totalMinor,
          ...quote.settlement,
          source: request.source,
          serviceLocation: request.serviceLocation,
          // Instant booking: the vendor's calendar is held from this moment,
          // and the booking confirms as soon as the card hold is in place.
          status: "ACCEPTED",
          paymentStatus: "PENDING_AUTHORISATION",
          sector,
          addressLine:
            request.serviceLocation === "CUSTOMER_ADDRESS" ? (request.addressLine ?? "") : "",
          notes: request.notes ?? "",
          customerId: request.customerId,
          hubId: quote.provider.hub.id,
          providerId: request.providerId,
          items: {
            create: quote.basket.map((line) => ({
              serviceId: line.id,
              name: line.name,
              priceMinor: line.priceMinor,
              durationMinutes: line.durationMinutes,
              kind: line.kind,
            })),
          },
          events: {
            create: [
              { fromStatus: null, toStatus: "REQUESTED", actor: "CUSTOMER" },
              {
                fromStatus: "REQUESTED",
                toStatus: "ACCEPTED",
                actor: "SYSTEM",
                note: `${request.source === "DIRECT_LINK" ? "Direct link" : "Marketplace"} booking; Rule ${quote.commission.rule} (${quote.commission.commissionBps / 100}% commission). Awaiting card hold.`,
              },
            ],
          },
        },
      });
    },
    { maxWait: 8_000, timeout: 15_000 },
  );

  const authorisation = await paymentGateway().authorise({
    bookingId: booking.id,
    amountMinor: quote.price.totalMinor + quote.settlement.tipMinor,
    customerEmail: request.customerEmail,
    description: `GLAMNET — ${quote.provider.name}`,
  });
  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentIntentId: authorisation.paymentIntentId },
  });

  return { bookingId: booking.id, authorisation };
}

export interface DirectoryVendor {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string;
  rating: number;
  completedBookings: number;
  workspaceType: string;
  sector: string;
  distanceKm: number | null;
  fromMinor: number | null;
  hubs: string[];
  lookbook: string[];
  /** Promoted by an admin: listed first, with a badge. */
  isFeatured: boolean;
}

/**
 * The marketplace directory (Directory §A): verified vendors in a city,
 * optionally narrowed to one Specialty Hub, sorted nearest-first to the
 * client's postcode sector when one is given, then by rating.
 */
export async function listDirectory(input: {
  city: string;
  hubName?: string | null;
  sector?: string | null;
}): Promise<DirectoryVendor[]> {
  const providers = await prisma.provider.findMany({
    where: {
      ...LIVE_VENDOR,
      hub: { city: { equals: input.city, mode: "insensitive" } },
      ...(input.hubName
        ? { services: { some: { service: { category: input.hubName, isActive: true } } } }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
      rating: true,
      completedBookings: true,
      workspaceType: true,
      workspaceSector: true,
      isFeatured: true,
      hub: { select: { sector: true } },
      lookbook: { orderBy: { position: "asc" }, take: 3, select: { url: true } },
      services: { select: SERVICE_SELECT },
    },
  });

  return providers
    .map((provider) => {
      const menu = menuFrom(provider.services);
      const inHub = input.hubName
        ? menu.filter((service) => service.category === input.hubName)
        : menu;
      const priced = inHub.filter((service) => service.kind === "SERVICE");
      const sector = provider.workspaceSector || provider.hub.sector;
      return {
        id: provider.id,
        slug: provider.slug ?? "",
        name: provider.name,
        avatarUrl: provider.avatarUrl,
        rating: provider.rating,
        completedBookings: provider.completedBookings,
        workspaceType: provider.workspaceType,
        sector,
        distanceKm: input.sector ? sectorDistanceKm(input.sector, sector) : null,
        fromMinor: priced.length ? Math.min(...priced.map((service) => service.priceMinor)) : null,
        hubs: [...new Set(menu.map((service) => service.category))],
        lookbook: provider.lookbook.map((image) => image.url),
        isFeatured: provider.isFeatured,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        (input.sector ? byDistance(a.distanceKm, b.distanceKm) : 0) ||
        b.rating - a.rating ||
        b.completedBookings - a.completedBookings,
    );
}
