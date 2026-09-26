import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { isSlugAvailable } from "@/lib/server/provider-portal";

/** GET /api/provider/slug?slug=grace-braids — is this link free? */
export async function GET(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const slug = (new URL(request.url).searchParams.get("slug") ?? "").toLowerCase();
    return NextResponse.json({ slug, available: await isSlugAvailable(slug, auth.providerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
