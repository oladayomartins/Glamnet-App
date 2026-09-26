import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { availabilitySchema } from "@/lib/api/schemas";
import { BookingError } from "@/lib/server/booking-service";
import { loadCandidates } from "@/lib/server/schedules";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import {
  addDays,
  buildDayGrid,
  startOfLocalDay,
} from "@/lib/domain/availability";
import {
  classifyBooking,
  noticePeriodMinutes,
  resolveThresholdMinutes,
} from "@/lib/domain/classification";
import { TRANSITION_BUFFER_MINUTES } from "@/lib/domain/constants";

/**
 * POST /api/availability — bookable start times for a day.
 *
 * The response tags each slot with its NORMAL/EMERGENCY classification, so the
 * date picker can warn the customer that a time falls inside the emergency
 * window *before* they commit to it (spec §1, §4).
 *
 * It returns the whole working-hours grid, including start times nobody is
 * free to take (`providerCount: 0`). The picker renders those struck through
 * rather than omitting them — an absent 16:00 reads as "they do not work
 * then", which is a different and untrue statement. Eligibility is decided
 * here either way; the client never computes it.
 */
export async function POST(request: Request) {
  try {
    const { hubId, serviceIds, date } = availabilitySchema.parse(
      await request.json(),
    );
    const now = new Date();

    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new BookingError("Unknown Beauty Hub.", "UNKNOWN_HUB", 404);

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
    });
    if (services.length !== new Set(serviceIds).size) {
      throw new BookingError("One or more services are unavailable.", "UNKNOWN_SERVICE");
    }

    const serviceDurationMinutes = services.reduce(
      (total, service) => total + service.durationMinutes,
      0,
    );

    const dayStart = startOfLocalDay(date);
    const dayEnd = addDays(dayStart, 1);
    const candidates = await loadCandidates(hub, dayStart, dayEnd);

    const requiredServiceIds = services
      .filter((service) => service.kind !== "ADDON")
      .map((service) => service.id);

    // Only vendors who can actually deliver the basket may supply slots.
    const qualified = candidates.filter((candidate) =>
      requiredServiceIds.every((serviceId) =>
        candidate.serviceIds.includes(serviceId),
      ),
    );

    const config = await getActiveEmergencyConfig(now);
    const thresholdMinutes = resolveThresholdMinutes(config, now);

    const slots = buildDayGrid(
      dayStart,
      serviceDurationMinutes,
      qualified.map((candidate) => candidate.schedule),
      now,
    ).map((slot) => {
      const notice = noticePeriodMinutes(now, slot.startAt);
      return {
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        noticePeriodMinutes: notice,
        bookingType: classifyBooking(notice, thresholdMinutes),
        providerCount: slot.availableProviderIds.length,
      };
    });

    return NextResponse.json({
      date: dayStart.toISOString(),
      serviceDurationMinutes,
      reservedDurationMinutes: serviceDurationMinutes + TRANSITION_BUFFER_MINUTES,
      transitionBufferMinutes: TRANSITION_BUFFER_MINUTES,
      emergencyThresholdMinutes: thresholdMinutes,
      slots,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
