import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { vendorCodeSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { createVendorCode, listVendorCodes } from "@/lib/server/vendor-codes";

export const dynamic = "force-dynamic";

/** GET /api/provider/codes — the signed-in vendor's own discount codes. */
export async function GET() {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    return NextResponse.json({ codes: await listVendorCodes(auth.providerId) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/provider/codes — create a discount code for the vendor's storefront. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const input = vendorCodeSchema.parse(await request.json());
    const code = await createVendorCode(auth.providerId, input);
    return NextResponse.json({ code: { id: code.id, code: code.code } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
