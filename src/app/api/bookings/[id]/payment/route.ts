import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { confirmAuthorisation } from "@/lib/server/escrow";

/**
 * POST /api/bookings/:id/payment — called once Stripe.js has confirmed the
 * card. The hold is verified with Stripe, not taken on the browser's word.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["CUSTOMER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.customerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const booking = await confirmAuthorisation(id, auth.user.customerId);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status, paymentStatus: booking.paymentStatus },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
