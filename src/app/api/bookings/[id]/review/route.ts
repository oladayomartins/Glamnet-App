import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { reviewSchema } from "@/lib/api/schemas";
import { reviewBooking } from "@/lib/server/lifecycle";
import { requireApiRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/server/prisma";
import { BookingError } from "@/lib/server/booking-service";

/**
 * POST /api/bookings/:id/review — customer rating, moving to REVIEWED.
 * Reviews follow the PIN release and are append-only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Only the customer rates the work.
    const auth = await requireApiRole(["CUSTOMER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;

    // The customer who had the appointment, not any customer.
    if (auth.user.role === "CUSTOMER") {
      const owned = await prisma.booking.findUnique({
        where: { id },
        select: { customerId: true },
      });
      if (!owned || owned.customerId !== auth.user.customerId) {
        throw new BookingError("Booking not found.", "NOT_FOUND", 404);
      }
    }

    const { rating, note } = reviewSchema.parse(await request.json());
    const booking = await reviewBooking(id, rating, note ?? "");
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
