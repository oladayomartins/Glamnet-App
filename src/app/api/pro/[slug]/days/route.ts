import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { storefrontDaysSchema } from "@/lib/api/schemas";
import { BookingError } from "@/lib/server/booking-service";
import { storefrontDaysForBasket } from "@/lib/server/storefront";

/**
 * POST /api/pro/:slug/days — the storefront's day picker: the next two weeks
 * for this vendor and basket, each closed, full or free, with the first free
 * start. The picker opens on the first free day instead of a dead end.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { serviceIds, from } = storefrontDaysSchema.parse(await request.json());
    const provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
    if (!provider) throw new BookingError("Storefront not found.", "NOT_FOUND", 404);
    return NextResponse.json({ days: await storefrontDaysForBasket(provider.id, serviceIds, from ?? new Date()) });
  } catch (error) {
    return errorResponse(error);
  }
}
