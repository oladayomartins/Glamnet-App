import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { transitionSchema } from "@/lib/api/schemas";
import { transitionBooking } from "@/lib/server/lifecycle";
import type { AnyBookingStatus } from "@/lib/domain/types";

/** POST /api/bookings/:id/status — advance the operational lifecycle. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
