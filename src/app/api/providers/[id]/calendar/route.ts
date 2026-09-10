import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { parseQueryDate } from "@/lib/api/parse-date";
import { BookingError } from "@/lib/server/booking-service";
import { CALENDAR_HOLDING_STATUSES } from "@/lib/server/schedules";
import {
  addDays,
  startOfLocalDay,
  startOfWeek,
} from "@/lib/domain/availability";
import { TRANSITION_BUFFER_MINUTES } from "@/lib/domain/constants";
import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/providers/:id/calendar?view=day|week&date=ISO
 *
 * Everything the provider calendar needs (spec §2): confirmed appointments, the
 * reserved period including the 15-minute buffer, blocked periods and the
 * working windows the day view is drawn against. Emergency bookings are tagged
 * so the UI can identify them.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // A provider's calendar is theirs alone; admins may also view it.
    const viewer = await getSessionUser();
    if (!viewer || (viewer.role !== "ADMIN" && viewer.providerId !== id)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not your calendar." } },
        { status: 403 },
      );
    }
    const search = new URL(request.url).searchParams;
    const view = search.get("view") === "week" ? "week" : "day";
    const anchor = search.has("date")
      ? parseQueryDate(search.get("date"))
      : new Date();

    if (!anchor) {
      throw new BookingError(
        "Invalid date. Use YYYY-MM-DD or an ISO 8601 timestamp.",
        "NOT_FOUND",
        400,
      );
    }

    const from = view === "week" ? startOfWeek(anchor) : startOfLocalDay(anchor);
    const to = addDays(from, view === "week" ? 7 : 1);

    const provider = await prisma.provider.findUnique({
      where: { id },
      include: { availability: { orderBy: { dayOfWeek: "asc" } } },
    });
    if (!provider) throw new BookingError("Provider not found.", "NOT_FOUND", 404);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: id,
        status: { in: [...CALENDAR_HOLDING_STATUSES] },
        appointmentStartAt: { lt: to },
        reservedUntilAt: { gt: from },
      },
      orderBy: { appointmentStartAt: "asc" },
      include: {
        items: true,
        customer: { select: { name: true } },
        hub: { select: { name: true, sector: true } },
      },
    });

    const timeOff = await prisma.providerTimeOff.findMany({
      where: { providerId: id, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: "asc" },
    });

    return NextResponse.json({
      view,
      from: from.toISOString(),
      to: to.toISOString(),
      transitionBufferMinutes: TRANSITION_BUFFER_MINUTES,
      workingWindows: provider.availability.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
      entries: bookings.map((booking) => ({
        id: booking.id,
        bookingType: booking.bookingType,
        status: booking.status,
        appointmentStartAt: booking.appointmentStartAt.toISOString(),
        /** End of the billable service. */
        appointmentEndAt: new Date(
          booking.appointmentStartAt.getTime() +
            booking.serviceDurationMinutes * 60_000,
        ).toISOString(),
        /** End of the calendar lock, i.e. including the transition buffer. */
        reservedUntilAt: booking.reservedUntilAt.toISOString(),
        serviceDurationMinutes: booking.serviceDurationMinutes,
        reservedDurationMinutes: booking.reservedDurationMinutes,
        customerName: booking.customer.name,
        sector: booking.hub.sector,
        services: booking.items.map((item) => item.name),
        earningsMinor: booking.providerEarningsMinor,
      })),
      blocks: timeOff.map((block) => ({
        id: block.id,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        reason: block.reason,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
