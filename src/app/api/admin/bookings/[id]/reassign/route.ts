import { adminRoute } from "@/lib/api/admin-route";
import { reassignBooking } from "@/lib/server/admin/booking-actions";

/** POST /api/admin/bookings/:id/reassign — move a booked appointment to another vendor. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const booking = await reassignBooking(actor, params.id, body);
  return { booking: { id: booking.id, providerId: booking.providerId } };
});
