import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { releaseSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { releaseWithPin } from "@/lib/server/escrow";

/**
 * POST /api/bookings/:id/release — the vendor enters the customer's PIN.
 * A match captures the card hold and pays the vendor (escrow_released).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const { pin } = releaseSchema.parse(await request.json());
    const booking = await releaseWithPin(id, auth.user.providerId, pin);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status, paymentStatus: booking.paymentStatus },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
