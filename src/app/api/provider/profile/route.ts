import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { storefrontProfileSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { updateStorefrontProfile } from "@/lib/server/provider-portal";

/** PATCH /api/provider/profile — the vendor's own storefront details. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const input = storefrontProfileSchema.parse(await request.json());
    const provider = await updateStorefrontProfile(auth.providerId, input);
    return NextResponse.json({ provider: { id: provider.id, slug: provider.slug } });
  } catch (error) {
    return errorResponse(error);
  }
}
