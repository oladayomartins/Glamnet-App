import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { reviewSchema } from "@/lib/api/schemas";
import { reviewBooking } from "@/lib/server/lifecycle";

/** POST /api/bookings/:id/review — customer rating, moving to REVIEWED. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { rating } = reviewSchema.parse(await request.json());
    const booking = await reviewBooking(id, rating);
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
