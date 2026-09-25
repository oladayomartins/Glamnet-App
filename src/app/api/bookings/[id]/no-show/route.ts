import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { markNoShow } from "@/lib/server/cancellations";

/**
 * POST /api/bookings/:id/no-show — the vendor waited and the client didn't
 * come. Charges the missed-appointment fee, which the client can dispute
 * for 24 hours.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const booking = await markNoShow(id, auth.user.providerId);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status, cancellationFeeMinor: booking.cancellationFeeMinor },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
