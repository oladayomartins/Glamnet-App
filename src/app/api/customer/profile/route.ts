import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { BookingError } from "@/lib/server/booking-service";
import { lookupPlace } from "@/lib/server/geo";
import { formatPostcode, outwardCode } from "@/lib/domain/postcode";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  postcode: z.string().trim().max(10).optional(),
});

/**
 * PATCH /api/customer/profile — the signed-in customer's own details.
 * The postcode is looked up so "pros near you" can measure from it; it is
 * never shown to anyone else.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireApiRole(["CUSTOMER"]);
    if ("response" in auth) return auth.response;
    if (!auth.user.customerId) throw new BookingError("No customer profile.", "NOT_FOUND", 404);

    const input = schema.parse(await request.json());
    let location: { postcode: string; latitude: number | null; longitude: number | null } | undefined;
    if (input.postcode !== undefined) {
      if (!input.postcode) {
        location = { postcode: "", latitude: null, longitude: null };
      } else {
        const place = await lookupPlace(input.postcode);
        if (!place) {
          throw new BookingError("We couldn't find that postcode. Check it and try again.", "INVALID_TRANSITION", 422);
        }
        location = {
          postcode: place.postcode ?? formatPostcode(input.postcode) ?? outwardCode(input.postcode) ?? "",
          latitude: place.lat,
          longitude: place.lng,
        };
      }
    }

    const customer = await prisma.customer.update({
      where: { id: auth.user.customerId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(location ?? {}),
      },
      select: { name: true, phone: true, postcode: true },
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return errorResponse(error);
  }
}
