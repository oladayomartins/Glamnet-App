import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { storefrontCheckoutSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { createStorefrontBooking } from "@/lib/server/storefront";
import { markAuthorised } from "@/lib/server/escrow";
import { paymentGateway } from "@/lib/server/payments";

/**
 * POST /api/pro/:slug/checkout — place a storefront booking and its card hold.
 *
 * The customer is the signed-in one, never an id from the body. The response
 * carries Stripe's client secret for the browser to confirm the card; on the
 * simulated gateway the hold is already in place and the booking confirmed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const auth = await requireApiRole(["CUSTOMER"]);
    if ("response" in auth) return auth.response;
    const { customerId, email } = auth.user;
    if (!customerId) throw new BookingError("Sign in as a customer to book.", "NOT_FOUND", 403);

    const { slug } = await params;
    const input = storefrontCheckoutSchema.parse(await request.json());
    const provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
    if (!provider) throw new BookingError("Storefront not found.", "NOT_FOUND", 404);

    const { bookingId, authorisation } = await createStorefrontBooking({
      ...input,
      providerId: provider.id,
      customerId,
      customerEmail: email,
    });

    if (authorisation.state === "AUTHORISED") {
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      await markAuthorised(booking);
    }

    return NextResponse.json(
      {
        bookingId,
        paymentMode: paymentGateway().mode,
        clientSecret: authorisation.clientSecret,
        authorised: authorisation.state === "AUTHORISED",
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
