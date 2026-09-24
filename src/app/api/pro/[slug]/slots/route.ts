import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { storefrontSlotsSchema } from "@/lib/api/schemas";
import { BookingError } from "@/lib/server/booking-service";
import { storefrontSlots } from "@/lib/server/storefront";

/**
 * POST /api/pro/:slug/slots — the storefront's calendar matrix: every start
 * time on a day for this vendor and basket, marked free or taken against
 * their real bookings, blocks and working hours.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { serviceIds, date } = storefrontSlotsSchema.parse(await request.json());
    const provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
    if (!provider) throw new BookingError("Storefront not found.", "NOT_FOUND", 404);
    return NextResponse.json(await storefrontSlots(provider.id, serviceIds, date));
  } catch (error) {
    return errorResponse(error);
  }
}
