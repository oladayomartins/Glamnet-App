import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { createBookingSchema } from "@/lib/api/schemas";
import { createBooking } from "@/lib/server/booking-service";
import { requireApiRole } from "@/lib/auth/api-guard";
import { withoutPin } from "@/lib/api/redact";

/**
 * GET /api/bookings?customerId=…&type=…&status=…
 *
 * Scoped to the caller: a customer sees their own bookings, a vendor their
 * own jobs, an admin everything. It used to answer anyone, which exposed
 * every customer's bookings to the open internet.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    const { user } = auth;

    const params = new URL(request.url).searchParams;
    const customerId =
      user.role === "CUSTOMER" ? (user.customerId ?? "none") : params.get("customerId");
    const bookingType = params.get("type");
    const status = params.get("status");

    const bookings = await prisma.booking.findMany({
      where: {
        ...(user.role === "PROVIDER" ? { providerId: user.providerId ?? "none" } : {}),
        ...(customerId ? { customerId } : {}),
        ...(bookingType ? { bookingType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { appointmentStartAt: "desc" },
      include: { items: true, provider: { select: { id: true, name: true } }, hub: true },
      take: 100,
    });

    return NextResponse.json({
      bookings: user.role === "CUSTOMER" ? bookings : bookings.map(withoutPin),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/bookings — place a booking.
 *
 * Corresponds to the point in the journey (spec §13) just after Stripe
 * pre-authorisation: the booking is created and immediately broadcast to the
 * top five eligible vendors. Classification and price are recomputed here
 * from the request's intent, never read from the client.
 */
export async function POST(request: Request) {
  try {
    // Only a signed-in customer may place a booking.
    const auth = await requireApiRole(["CUSTOMER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const input = createBookingSchema.parse(await request.json());
    // A customer books as themselves — never as whichever id the body names.
    if (auth.user.role === "CUSTOMER" && input.customerId !== auth.user.customerId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You can only book for yourself." } },
        { status: 403 },
      );
    }
    const booking = await createBooking(input);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
