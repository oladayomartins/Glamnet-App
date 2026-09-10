import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { acceptSchema } from "@/lib/api/schemas";
import { acceptBooking } from "@/lib/server/booking-service";

/**
 * POST /api/bookings/:id/accept — a provider takes the job.
 *
 * The calendar lock (service duration + 15-minute transition) is applied
 * atomically with the claim, so concurrent acceptances cannot double-book.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { providerId } = acceptSchema.parse(await request.json());
    const booking = await acceptBooking(id, providerId);
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
