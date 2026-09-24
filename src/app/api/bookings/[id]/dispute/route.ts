import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { disputeSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { fileDispute } from "@/lib/server/escrow";

/**
 * POST /api/bookings/:id/dispute — [ File a Service Dispute ].
 * Refused once the 24-hour window after release has passed, whatever the
 * page happened to render.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["CUSTOMER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.customerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const { reason } = disputeSchema.parse(await request.json());
    await fileDispute(id, auth.user.customerId, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
