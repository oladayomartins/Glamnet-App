import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { BookingError } from "@/lib/server/booking-service";

/** GET /api/bookings/:id — full booking record with lifecycle history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        items: true,
        hub: true,
        customer: true,
        provider: { select: { id: true, name: true, rating: true } },
        events: { orderBy: { createdAt: "asc" } },
        broadcasts: { include: { provider: { select: { id: true, name: true } } } },
      },
    });

    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    // The address is withheld until the ADDRESS_UNLOCKED step (spec §8).
    return NextResponse.json({
      booking: {
        ...booking,
        addressLine: booking.addressUnlocked ? booking.addressLine : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
