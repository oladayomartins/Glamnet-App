import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { acceptSchema } from "@/lib/api/schemas";
import { acceptBooking } from "@/lib/server/booking-service";
import { requireApiRole } from "@/lib/auth/api-guard";
import { requireOwnProvider } from "@/lib/auth/provider-guard";

/**
 * POST /api/bookings/:id/accept — a vendor takes the job.
 *
 * The calendar lock (service duration + 15-minute transition) is applied
 * atomically with the claim, so concurrent acceptances cannot double-book.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Only a vendor may accept work.
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { providerId } = acceptSchema.parse(await request.json());
    // A vendor may only accept for themselves. Without this, any vendor could
    // put a competitor's id in the body and assign them work they never took.
    const denied = requireOwnProvider(auth.user, providerId);
    if (denied) return denied;

    const booking = await acceptBooking(id, providerId);
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
