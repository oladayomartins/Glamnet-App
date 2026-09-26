import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getActiveEmergencyConfig } from "./emergency-config";
import { loadCandidates } from "./schedules";
import {
  basketDurationMinutes,
  classifyBooking,
  noticePeriodMinutes,
  resolveThresholdMinutes,
} from "@/lib/domain/classification";
import { priceBooking, type PriceBreakdown } from "@/lib/domain/pricing";
import { addMinutes, reservationWindow } from "@/lib/domain/availability";
import { selectBroadcastTargets } from "@/lib/domain/matching";
import { TRANSITION_BUFFER_MINUTES } from "@/lib/domain/constants";
import type { BasketLine, BookingType } from "@/lib/domain/types";
import { applyBps } from "@/lib/domain/pricing";
import {
  decideCommission,
  settle,
  type BookingSource,
  type CommissionDecision,
} from "@/lib/domain/settlement";
import { deliverBookingConfirmedEmail } from "./notifications";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "EMPTY_BASKET"
      | "UNKNOWN_SERVICE"
      | "UNKNOWN_HUB"
      | "PAST_APPOINTMENT"
      | "NO_PROVIDER"
      | "ALREADY_TAKEN"
      | "NOT_INVITED"
      | "INVALID_TRANSITION"
      | "CONTENDED"
      | "NOT_FOUND",
    readonly status = 400,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/**
 * The money fields a booking stores once its commission rule is known.
 *
 * `providerEarningsMinor` stays the vendor's share *before* any tip, which is
 * what the earnings ledger has always shown; `providerPayoutMinor` is what is
 * actually transferred at release, tip included.
 */
export function settlementFields(
  price: {
    totalMinor: number;
    subtotalMinor: number;
    emergencySurchargeMinor: number;
    otherSurchargesMinor: number;
    trustFeeMinor: number;
  },
  commission: CommissionDecision,
  tipMinor = 0,
  discountMinor = 0,
) {
  const result = settle({
    totalMinor: price.totalMinor,
    commissionableMinor:
      price.subtotalMinor + price.emergencySurchargeMinor + price.otherSurchargesMinor,
    trustFeeMinor: price.trustFeeMinor,
    tipMinor,
    commission,
    discountMinor,
  });
  const tip = result.chargeMinor + result.discountMinor - price.totalMinor;
  return {
    firstDiscoveryBooking: commission.firstDiscoveryBooking,
    commissionBps: commission.commissionBps,
    tipMinor: tip,
    discountMinor: result.discountMinor,
    platformCommissionMinor: result.platformCommissionMinor,
    processingFeeMinor: result.processingFeeMinor,
    providerPayoutMinor: result.providerPayoutMinor,
    providerEarningsMinor: result.providerPayoutMinor - tip,
    providerEmergencyEarningsMinor: applyBps(
      price.emergencySurchargeMinor,
      10_000 - commission.commissionBps,
    ),
  };
}

/** Customers each vendor has already served — they are no longer "new". */
export async function servedCustomer(
  customerId: string,
  providerIds: string[],
): Promise<Set<string>> {
  if (providerIds.length === 0) return new Set();
  const prior = await prisma.booking.findMany({
    where: {
      customerId,
      providerId: { in: providerIds },
      status: {
        in: [
          "ACCEPTED",
          "CONFIRMED",
          "ADDRESS_UNLOCKED",
          "PROVIDER_EN_ROUTE",
          "ARRIVED",
          "IN_PROGRESS",
          "COMPLETED",
          "PAYMENT_RELEASED",
          "REVIEWED",
        ],
      },
    },
    select: { providerId: true },
    distinct: ["providerId"],
  });
  return new Set(prior.map((booking) => booking.providerId ?? ""));
}

export interface QuoteRequest {
  hubId: string;
  serviceIds: string[];
  appointmentStartAt: Date;
}

export interface Quote {
  bookingType: BookingType;
  noticePeriodMinutes: number;
  thresholdMinutesUsed: number;
  serviceDurationMinutes: number;
  reservedDurationMinutes: number;
  appointmentStartAt: Date;
  appointmentEndAt: Date;
  reservedUntilAt: Date;
  sector: string;
  basket: BasketLine[];
  price: PriceBreakdown;
  /** Vendors who could take this slot right now. */
  eligibleProviderIds: string[];
}

/**
 * Build a full server-side quote: classification, duration, price and vendor
 * eligibility.
 *
 * This is the single source of truth for both the checkout preview and the
 * booking that follows, so the customer can never be shown one price and
 * charged another, and can never influence the classification — they supply
 * only the hub, the services and the appointment time.
 */
export async function quoteBooking(
  request: QuoteRequest,
  now: Date = new Date(),
): Promise<Quote> {
  if (request.serviceIds.length === 0) {
    throw new BookingError("Select at least one service.", "EMPTY_BASKET");
  }

  const hub = await prisma.hub.findUnique({ where: { id: request.hubId } });
  if (!hub) throw new BookingError("Unknown Beauty Hub.", "UNKNOWN_HUB", 404);

  const services = await prisma.service.findMany({
    where: { id: { in: request.serviceIds }, isActive: true },
  });
  if (services.length !== new Set(request.serviceIds).size) {
    throw new BookingError("One or more services are unavailable.", "UNKNOWN_SERVICE");
  }

  if (request.appointmentStartAt.getTime() <= now.getTime()) {
    throw new BookingError(
      "Choose an appointment time in the future.",
      "PAST_APPOINTMENT",
    );
  }

  const basket: BasketLine[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    priceMinor: service.priceMinor,
    durationMinutes: service.durationMinutes,
    kind: service.kind === "ADDON" ? "ADDON" : "SERVICE",
  }));

  const config = await getActiveEmergencyConfig(now);
  const thresholdMinutesUsed = resolveThresholdMinutes(config, now);
  const notice = noticePeriodMinutes(now, request.appointmentStartAt);
  const bookingType = classifyBooking(notice, thresholdMinutesUsed);

  const serviceDuration = basketDurationMinutes(basket);
  const window = reservationWindow(request.appointmentStartAt, serviceDuration);

  const price = priceBooking(
    {
      basket,
      bookingType,
      travelFeeMinor: hub.travelFeeMinor,
      emergencyConfig: config,
    },
    now,
  );

  const candidates = await loadCandidates(hub, window.startAt, window.endAt);
  const eligible = selectBroadcastTargets(candidates, {
    sector: hub.sector,
    requiredServiceIds: basket
      .filter((line) => line.kind === "SERVICE")
      .map((line) => line.id),
    appointmentStartAt: request.appointmentStartAt,
    serviceDurationMinutes: serviceDuration,
  });

  return {
    bookingType,
    noticePeriodMinutes: notice,
    thresholdMinutesUsed,
    serviceDurationMinutes: serviceDuration,
    reservedDurationMinutes: serviceDuration + TRANSITION_BUFFER_MINUTES,
    appointmentStartAt: request.appointmentStartAt,
    appointmentEndAt: addMinutes(request.appointmentStartAt, serviceDuration),
    reservedUntilAt: window.endAt,
    sector: hub.sector,
    basket,
    price,
    eligibleProviderIds: eligible.map((match) => match.providerId),
  };
}

export interface CreateBookingRequest extends QuoteRequest {
  customerId: string;
  addressLine?: string;
  notes?: string;
  referenceImageUrl?: string;
  referenceImageFileId?: string;
}

/**
 * Create a broadcast booking, ready for its card.
 *
 * The booking waits at REQUESTED until the customer's card is secured; only
 * then is it broadcast (see `dispatchBroadcast` in payment-flow). Sending a
 * request to five vendors before anyone knew the customer could pay meant
 * vendors accepting jobs with no money behind them.
 *
 * The quote is recomputed here rather than accepted from the client, so the
 * stored classification, duration and price are all server-derived (spec §9,
 * §12 "Customer cannot override the classification"). The vendor list is
 * checked now so a customer isn't asked for a card when nobody could come,
 * and again at broadcast time.
 */
export async function createBooking(
  request: CreateBookingRequest,
  now: Date = new Date(),
) {
  const quote = await quoteBooking(request, now);

  if (quote.eligibleProviderIds.length === 0) {
    throw new BookingError(
      "No vendors are available for that time. Please choose another slot.",
      "NO_PROVIDER",
      409,
    );
  }

  // Provisional (Rule B) until a vendor accepts and the rule is final.
  const provisional = settlementFields(
    quote.price,
    decideCommission({ source: "BROADCAST", hasPriorBooking: false }),
  );

  return prisma.booking.create({
    data: {
      bookingType: quote.bookingType,
      bookingCreatedAt: now,
      appointmentStartAt: quote.appointmentStartAt,
      noticePeriodMinutes: quote.noticePeriodMinutes,
      thresholdMinutesUsed: quote.thresholdMinutesUsed,
      serviceDurationMinutes: quote.serviceDurationMinutes,
      reservedDurationMinutes: quote.reservedDurationMinutes,
      reservedUntilAt: quote.reservedUntilAt,
      subtotalMinor: quote.price.subtotalMinor,
      travelFeeMinor: quote.price.travelFeeMinor,
      emergencySurchargeMinor: quote.price.emergencySurchargeMinor,
      otherSurchargesMinor: quote.price.otherSurchargesMinor,
      trustFeeMinor: quote.price.trustFeeMinor,
      totalInvoicePriceMinor: quote.price.totalMinor,
      ...provisional,
      source: "BROADCAST",
      status: "REQUESTED",
      sector: quote.sector,
      addressLine: request.addressLine ?? "",
      notes: request.notes ?? "",
      referenceImageUrl: request.referenceImageUrl ?? "",
      referenceImageFileId: request.referenceImageFileId ?? "",
      customerId: request.customerId,
      hubId: request.hubId,
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
        create: [{ fromStatus: null, toStatus: "REQUESTED", actor: "CUSTOMER", note: "Awaiting card." }],
      },
    },
  });
}

/**
 * Postgres error codes meaning "another transaction got in the way", rather
 * than anything wrong with this request.
 *
 * P2028 is a transaction that could not be started in time — which is what a
 * contended accept looks like when the connection pool is busy. P2034 is a
 * write conflict or deadlock. Neither tells us whether the booking was taken,
 * so neither may be reported as "already accepted".
 */
function isContention(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2028" || error.code === "P2034")
  );
}

/**
 * Run a transaction, retrying once if it lost a race to start.
 *
 * The retry is what turns a contended accept into a correct answer: the loser
 * comes back, finds the booking is no longer BROADCAST, and gets a clean
 * ALREADY_TAKEN instead of an opaque failure. Only contention is retried —
 * a real error is rethrown untouched.
 */
async function withContentionRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isContention(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      return await run();
    } catch (retryError) {
      if (!isContention(retryError)) throw retryError;
      throw new BookingError(
        "Another vendor is responding to this booking right now. Try again in a moment.",
        "CONTENDED",
        409,
      );
    }
  }
}

/**
 * A vendor accepts a broadcast request (spec §12 "Concurrent booking
 * acceptance is transactionally protected").
 *
 * Everything happens in one transaction, and the winning update is guarded by
 * `status: "BROADCAST"` — so if two vendors accept at the same instant, the
 * second update matches zero rows and that caller is told the job is gone
 * rather than double-booking the slot.
 */
export async function acceptBooking(
  bookingId: string,
  providerId: string,
  now: Date = new Date(),
) {
  const booking = await withContentionRetry(() =>
    prisma.$transaction(async (tx) => {
    const invite = await tx.bookingBroadcast.findUnique({
      where: { bookingId_providerId: { bookingId, providerId } },
    });
    if (!invite) {
      throw new BookingError(
        "This request was not offered to you.",
        "NOT_INVITED",
        403,
      );
    }

    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    // Re-check the calendar inside the transaction: the vendor may have
    // accepted another job since the broadcast was sent (spec §7).
    const conflict = await tx.booking.findFirst({
      where: {
        providerId,
        id: { not: bookingId },
        status: {
          in: [
            "ACCEPTED",
            "CONFIRMED",
            "ADDRESS_UNLOCKED",
            "PROVIDER_EN_ROUTE",
            "ARRIVED",
            "IN_PROGRESS",
            "COMPLETED",
            "REVIEWED",
            "PAYMENT_RELEASED",
          ],
        },
        appointmentStartAt: { lt: booking.reservedUntilAt },
        reservedUntilAt: { gt: booking.appointmentStartAt },
      },
    });
    if (conflict) {
      throw new BookingError(
        "That period conflicts with another confirmed booking.",
        "ALREADY_TAKEN",
        409,
      );
    }

    // The guard that makes concurrent acceptance safe.
    const claimed = await tx.booking.updateMany({
      where: { id: bookingId, status: "BROADCAST", providerId: null },
      data: { status: "ACCEPTED", providerId },
    });
    if (claimed.count === 0) {
      throw new BookingError(
        "This booking has already been accepted by another vendor.",
        "ALREADY_TAKEN",
        409,
      );
    }

    // The rule is final now that the vendor is known.
    const prior = await tx.booking.findFirst({
      where: {
        customerId: booking.customerId,
        providerId,
        id: { not: bookingId },
        status: {
          in: [
            "ACCEPTED",
            "CONFIRMED",
            "ADDRESS_UNLOCKED",
            "PROVIDER_EN_ROUTE",
            "ARRIVED",
            "IN_PROGRESS",
            "COMPLETED",
            "PAYMENT_RELEASED",
            "REVIEWED",
          ],
        },
      },
      select: { id: true },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: settlementFields(
        {
          totalMinor: booking.totalInvoicePriceMinor,
          subtotalMinor: booking.subtotalMinor,
          emergencySurchargeMinor: booking.emergencySurchargeMinor,
          otherSurchargesMinor: booking.otherSurchargesMinor,
          trustFeeMinor: booking.trustFeeMinor,
        },
        decideCommission({
          source: booking.source as BookingSource,
          hasPriorBooking: prior !== null,
        }),
        booking.tipMinor,
      ),
    });

    await tx.bookingBroadcast.update({
      where: { bookingId_providerId: { bookingId, providerId } },
      data: { status: "ACCEPTED", respondedAt: now },
    });
    await tx.bookingBroadcast.updateMany({
      where: { bookingId, providerId: { not: providerId }, status: "PENDING" },
      data: { status: "LOST", respondedAt: now },
    });

    await tx.bookingStatusEvent.create({
      data: {
        bookingId,
        fromStatus: "BROADCAST",
        toStatus: "ACCEPTED",
        actor: "PROVIDER",
        note: `Calendar reserved until ${booking.reservedUntilAt.toISOString()}.`,
      },
    });

    await tx.notification.create({
      data: {
        bookingId,
        audience: "CUSTOMER",
        channel: "PUSH",
        bookingType: booking.bookingType,
        title:
          booking.bookingType === "EMERGENCY"
            ? "EMERGENCY BOOKING confirmed"
            : "Your booking is confirmed",
        body: "A vendor has accepted your request.",
      },
    });

    return tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { items: true, provider: true, customer: true },
    });
    },
    // Room to queue behind a competing accept rather than failing outright.
    { maxWait: 8_000, timeout: 15_000 },
    ),
  );

  // Same rule as the broadcast: the customer is told once the claim is durable.
  await deliverBookingConfirmedEmail({
    bookingId: booking.id,
    customerName: booking.customer.name,
    customerEmail: booking.customer.email,
    providerName: booking.provider?.name ?? "Your vendor",
    isEmergency: booking.bookingType === "EMERGENCY",
    serviceNames: booking.items.map((item) => item.name),
    appointmentStartAt: booking.appointmentStartAt,
    sector: booking.sector,
    totalInvoicePriceMinor: booking.totalInvoicePriceMinor,
  });

  return booking;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
