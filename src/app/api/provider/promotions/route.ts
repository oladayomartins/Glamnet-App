import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { startPromotionCheckout } from "@/lib/server/promotions";

const purchaseSchema = z.object({
  productKey: z.string().max(40),
  days: z.number().int(),
});

/**
 * POST /api/provider/promotions — reserve a promotion slot and open checkout.
 * Answers with the URL to send the vendor to.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { productKey, days } = purchaseSchema.parse(await request.json());
    const checkout = await startPromotionCheckout({ providerId: auth.providerId, productKey, days });
    return NextResponse.json(checkout);
  } catch (error) {
    return errorResponse(error);
  }
}
