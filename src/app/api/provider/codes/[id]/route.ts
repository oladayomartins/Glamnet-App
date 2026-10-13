import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { vendorCodePatchSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { deleteVendorCode, setVendorCodeActive } from "@/lib/server/vendor-codes";

/** PATCH /api/provider/codes/:id — pause or resume one of the vendor's codes. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const { isActive } = vendorCodePatchSchema.parse(await request.json());
    await setVendorCodeActive(auth.providerId, id, isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/provider/codes/:id — delete a code nobody has used yet. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    await deleteVendorCode(auth.providerId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
