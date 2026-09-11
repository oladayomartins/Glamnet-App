import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { formatNotice, noticePeriodMinutes } from "@/lib/domain/classification";
import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/providers/:id/requests — the vendor's broadcast inbox.
 *
 * Each open request carries everything spec §6 requires a vendor to see
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

    // A vendor's broadcast inbox is theirs alone; admins may also view it.
    const viewer = await getSessionUser();
    if (!viewer || (viewer.role !== "ADMIN" && viewer.providerId !== id)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not your broadcast inbox." } },
        { status: 403 },
      );
    }
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
        /**
         * Absolute deadline for the acceptance countdown. Sent as a timestamp
         * rather than a seconds-remaining count so response latency and a
         * long-lived page cannot skew the clock the vendor sees.
         */
        acceptanceExpiresAt: invite.expiresAt.toISOString(),
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}
