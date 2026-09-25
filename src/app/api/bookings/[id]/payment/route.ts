import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { confirmPayment, retryPayment } from "@/lib/server/payment-flow";

async function customerOf() {
  const auth = await requireApiRole(["CUSTOMER"]);
  if ("response" in auth) return auth;
  if (!auth.user.customerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  return { customerId: auth.user.customerId };
}

/**
 * POST /api/bookings/:id/payment — called once Stripe.js has confirmed the
 * card. The hold (or saved card) is verified with Stripe, not taken on the
 * browser's word; then the booking confirms or is broadcast.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await customerOf();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const booking = await confirmPayment(id, auth.customerId);
    return NextResponse.json({
      booking: { id: booking.id, status: booking.status, paymentStatus: booking.paymentStatus },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/bookings/:id/payment — start again with a card: after a hold was
 * declined or lapsed, or to finish a checkout that was left. Returns what
 * Stripe Elements needs.
 */
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await customerOf();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    return NextResponse.json({ payment: await retryPayment(id, auth.customerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
