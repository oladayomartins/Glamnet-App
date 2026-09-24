import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { BookingError } from "@/lib/server/booking-service";
import { getSessionUser } from "@/lib/auth/session";
import { withoutPin } from "@/lib/api/redact";

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

    // Ownership, not just a role. A signed-in vendor must not be able to
    // read another vendor's job, and a customer must not read someone
    // else's booking by guessing an id.
    const viewer = await getSessionUser();
    const mayView =
      viewer?.role === "ADMIN" ||
      (viewer?.customerId && viewer.customerId === booking.customerId) ||
      (viewer?.providerId && viewer.providerId === booking.providerId);

    if (!mayView) {
      // 404 rather than 403: confirming a booking exists to a stranger is
      // itself a disclosure.
      throw new BookingError("Booking not found.", "NOT_FOUND", 404);
    }

    // The address is withheld until the ADDRESS_UNLOCKED step (spec §8).
    const isCustomer = viewer?.customerId === booking.customerId;
    const visible = {
      ...booking,
      addressLine: booking.addressUnlocked ? booking.addressLine : null,
    };
    return NextResponse.json({ booking: isCustomer ? visible : withoutPin(visible) });
  } catch (error) {
    return errorResponse(error);
  }
}
