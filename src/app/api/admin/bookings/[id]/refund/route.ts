import { adminRoute } from "@/lib/api/admin-route";
import { refundBooking } from "@/lib/server/admin/booking-actions";

/** POST /api/admin/bookings/:id/refund — refund a paid booking, outside a dispute. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const booking = await refundBooking(actor, params.id, body);
  return { booking: { id: booking.id, refundedMinor: booking.refundedMinor, paymentStatus: booking.paymentStatus } };
});
