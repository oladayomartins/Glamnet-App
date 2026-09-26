import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { lookbookSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { replaceLookbook } from "@/lib/server/provider-portal";
import { isTrustedImageUrl } from "@/lib/imagekit";

/** PUT /api/provider/lookbook — the three storefront transformation photos. */
export async function PUT(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { images } = lookbookSchema.parse(await request.json());
    if (!images.every((image) => isTrustedImageUrl(image.url))) {
      throw new BookingError("Upload the photos through the app.", "INVALID_TRANSITION", 422);
    }
    await replaceLookbook(auth.providerId, images);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
