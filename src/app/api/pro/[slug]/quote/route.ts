import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { storefrontCheckoutSchema } from "@/lib/api/schemas";
import { BookingError } from "@/lib/server/booking-service";
import { getSessionUser } from "@/lib/auth/session";
import { quoteStorefront } from "@/lib/server/storefront";

/**
 * POST /api/pro/:slug/quote — the single transparent price card, computed
 * server-side before the card hold. Works signed out (the commission rule,
 * which the customer never pays, simply assumes a new client).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const input = storefrontCheckoutSchema.parse(await request.json());
    const provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
    if (!provider) throw new BookingError("Storefront not found.", "NOT_FOUND", 404);

    const viewer = await getSessionUser();
    const quote = await quoteStorefront({
      ...input,
      providerId: provider.id,
      customerId: viewer?.customerId ?? "",
    });

    return NextResponse.json({
      bookingType: quote.bookingType,
      durationMinutes: quote.duration,
      lines: quote.price.lines,
      tipMinor: quote.settlement.tipMinor,
      totalMinor: quote.price.totalMinor,
      chargeMinor: quote.price.totalMinor + quote.settlement.tipMinor,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
