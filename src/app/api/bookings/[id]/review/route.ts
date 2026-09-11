import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { reviewSchema } from "@/lib/api/schemas";
import { reviewBooking } from "@/lib/server/lifecycle";
import { requireApiRole } from "@/lib/auth/api-guard";

/** POST /api/bookings/:id/review — customer rating, moving to REVIEWED. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Only the customer rates the work.
    const auth = await requireApiRole(["CUSTOMER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { rating, note } = reviewSchema.parse(await request.json());
    const booking = await reviewBooking(id, rating, note ?? "");
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
