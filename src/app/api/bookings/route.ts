import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { createBookingSchema } from "@/lib/api/schemas";
import { createBooking } from "@/lib/server/booking-service";

/** GET /api/bookings?customerId=…&type=…&status=… */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const customerId = params.get("customerId");
    const bookingType = params.get("type");
    const status = params.get("status");

    const bookings = await prisma.booking.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(bookingType ? { bookingType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { appointmentStartAt: "desc" },
      include: { items: true, provider: { select: { id: true, name: true } }, hub: true },
      take: 100,
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/bookings — place a booking.
 *
 * Corresponds to the point in the journey (spec §13) just after Stripe
 * pre-authorisation: the booking is created and immediately broadcast to the
 * top five eligible providers. Classification and price are recomputed here
 * from the request's intent, never read from the client.
 */
export async function POST(request: Request) {
  try {
    const input = createBookingSchema.parse(await request.json());
    const booking = await createBooking(input);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
