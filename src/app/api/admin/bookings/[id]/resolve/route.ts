import { adminRoute } from "@/lib/api/admin-route";
import { resolveDispute } from "@/lib/server/admin/disputes";

/** POST /api/admin/bookings/:id/resolve — rule on a service dispute. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const booking = await resolveDispute(actor, params.id, body);
  return { booking: { id: booking.id, status: booking.status, settlementStatus: booking.settlementStatus } };
});
