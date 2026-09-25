import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { cancelSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { cancelBooking, type Canceller } from "@/lib/server/cancellations";

/**
 * POST /api/bookings/:id/cancel — cancel a booking.
 *
 * A customer pays whatever the cancellation policy says at this moment (the
 * page shows it first, and `acceptedFeeMinor` guards against it having gone
 * up since). A vendor cancelling costs the customer nothing.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    let by: Canceller;
    if (auth.user.role === "CUSTOMER" && auth.user.customerId) by = { role: "CUSTOMER", customerId: auth.user.customerId };
    else if (auth.user.role === "PROVIDER" && auth.user.providerId) by = { role: "PROVIDER", providerId: auth.user.providerId };
    else if (auth.user.role === "ADMIN") by = { role: "ADMIN" };
    else throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const input = cancelSchema.parse(await request.json().catch(() => ({})));
    const booking = await cancelBooking(id, by, input);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status, cancellationFeeMinor: booking.cancellationFeeMinor },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
