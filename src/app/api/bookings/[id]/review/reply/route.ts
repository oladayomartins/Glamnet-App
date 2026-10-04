import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { reviewReplySchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { replyToReview } from "@/lib/server/reviews";

/**
 * POST /api/bookings/:id/review/reply — the vendor's public reply under a
 * review. Posting again edits it; an empty reply removes it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiRole(["PROVIDER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
    const { id } = await params;
    const { reply } = reviewReplySchema.parse(await request.json());
    const review = await replyToReview(id, auth.user.providerId, reply);
    return NextResponse.json({ review });
  } catch (error) {
    return errorResponse(error);
  }
}
