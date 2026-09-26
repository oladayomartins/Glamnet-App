import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { transitionSchema } from "@/lib/api/schemas";
import { transitionBooking } from "@/lib/server/lifecycle";
import { cancelBooking } from "@/lib/server/cancellations";
import { BookingError } from "@/lib/server/booking-service";
import type { AnyBookingStatus } from "@/lib/domain/types";
import { requireApiRole } from "@/lib/auth/api-guard";
import { withoutPin } from "@/lib/api/redact";

/**
 * Steps that move money or carry evidence, and so have their own endpoints:
 * COMPLETED needs the three completion photos (/checkout-release),
 * PAYMENT_RELEASED needs the customer's PIN (/release), REVIEWED is the
 * customer's rating (/review), DISPUTED is the customer's (/dispute), and
 * NO_SHOW is the vendor's (/no-show). CANCELLED is accepted here but goes
 * through the cancellation service, which records who cancelled.
 */
const DEDICATED_STEPS = new Set(["COMPLETED", "PAYMENT_RELEASED", "REVIEWED", "DISPUTED", "NO_SHOW"]);

/** POST /api/bookings/:id/status — advance the operational lifecycle. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Lifecycle transitions belong to the vendor running the job, or an admin.
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { status, note } = transitionSchema.parse(await request.json());

    if (DEDICATED_STEPS.has(status)) {
      throw new BookingError(
        "That step has its own action and cannot be set directly.",
        "INVALID_TRANSITION",
        409,
      );
    }

    // The vendor on *this* job, not any vendor: without this check one
    // vendor could advance or cancel another's booking.
    if (auth.user.role === "PROVIDER") {
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: { providerId: true },
      });
      if (!booking || booking.providerId !== auth.user.providerId) {
        throw new BookingError("Booking not found.", "NOT_FOUND", 404);
      }
    }

    if (status === "CANCELLED") {
      const cancelled = await cancelBooking(
        id,
        auth.user.role === "PROVIDER" ? { role: "PROVIDER", providerId: auth.user.providerId! } : { role: "ADMIN" },
        { reason: note ?? "" },
      );
      return NextResponse.json({ booking: withoutPin(cancelled) });
    }

    const booking = await transitionBooking(
      id,
      status as AnyBookingStatus,
      // Taken from the session, never from the body.
      auth.user.role,
      note ?? "",
    );
    return NextResponse.json({ booking: withoutPin(booking) });
  } catch (error) {
    return errorResponse(error);
  }
}
