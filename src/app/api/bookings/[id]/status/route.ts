import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { transitionSchema } from "@/lib/api/schemas";
import { transitionBooking } from "@/lib/server/lifecycle";
import type { AnyBookingStatus } from "@/lib/domain/types";
import { requireApiRole } from "@/lib/auth/api-guard";

/** POST /api/bookings/:id/status — advance the operational lifecycle. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Lifecycle transitions belong to the provider running the job, or an admin.
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { status, actor, note } = transitionSchema.parse(await request.json());
    const booking = await transitionBooking(
      id,
      status as AnyBookingStatus,
      actor,
      note ?? "",
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
