import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { formatNotice, noticePeriodMinutes } from "@/lib/domain/classification";

/**
 * GET /api/providers/:id/requests — the provider's broadcast inbox.
 *
 * Each open request carries everything spec §6 requires a provider to see
 * before accepting: the emergency tag, the appointment time, the notice
 * remaining, the services, total duration, sector, earnings and the surge
 * component of those earnings.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const now = new Date();

    const invitations = await prisma.bookingBroadcast.findMany({
      where: {
        providerId: id,
        status: "PENDING",
        expiresAt: { gt: now },
        booking: { status: "BROADCAST" },
      },
      orderBy: { sentAt: "desc" },
      include: {
        booking: {
          include: { items: true, hub: { select: { sector: true, name: true } } },
        },
      },
    });

    const requests = invitations.map((invite) => {
      const { booking } = invite;
      const notice = noticePeriodMinutes(now, booking.appointmentStartAt);
      return {
        bookingId: booking.id,
        bookingType: booking.bookingType,
        appointmentStartAt: booking.appointmentStartAt.toISOString(),
        noticePeriodMinutes: notice,
        noticeLabel: formatNotice(notice),
        services: booking.items.map((item) => item.name),
        serviceDurationMinutes: booking.serviceDurationMinutes,
        reservedDurationMinutes: booking.reservedDurationMinutes,
        sector: booking.hub.sector,
        hubName: booking.hub.name,
        earningsMinor: invite.earningsMinor,
        emergencyEarningsMinor: invite.emergencyEarningsMinor,
        /** Seconds left on the acceptance countdown. */
        acceptanceSecondsRemaining: Math.max(
          0,
          Math.floor((invite.expiresAt.getTime() - now.getTime()) / 1_000),
        ),
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}
