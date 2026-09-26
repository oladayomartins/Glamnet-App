import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { documentSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { addDocument } from "@/lib/server/provider-portal";
import { isTrustedImageUrl } from "@/lib/imagekit";

/** POST /api/provider/documents — record an uploaded insurance/licence file. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const input = documentSchema.parse(await request.json());
    if (!isTrustedImageUrl(input.url)) {
      throw new BookingError("Upload the document through the app.", "INVALID_TRANSITION", 422);
    }
    const document = await addDocument(auth.providerId, input);
    return NextResponse.json({ document: { id: document.id } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
