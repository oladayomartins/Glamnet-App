import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { checkoutReleaseSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { reissuePin, requestCheckoutRelease } from "@/lib/server/escrow";
import { isTrustedImageUrl } from "@/lib/imagekit";

/**
 * POST /api/bookings/:id/checkout-release — [ Request Checkout Release ].
 * The vendor submits three photos of the finished work; the customer is
 * issued their 4-digit PIN.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    const { photos } = checkoutReleaseSchema.parse(await request.json());

    // Evidence has to live in our own media library, where it cannot be
    // swapped out after the fact.
    if (!photos.every((photo) => isTrustedImageUrl(photo.url))) {
      throw new BookingError("Upload the photos through the app.", "INVALID_TRANSITION", 422);
    }

    await requestCheckoutRelease(
      id,
      auth.user.providerId,
      photos.map((photo) => ({ url: photo.url, fileId: photo.fileId })),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PUT /api/bookings/:id/checkout-release — issue a fresh PIN. */
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.providerId) throw new BookingError("Booking not found.", "NOT_FOUND", 404);

    const { id } = await params;
    await reissuePin(id, auth.user.providerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
