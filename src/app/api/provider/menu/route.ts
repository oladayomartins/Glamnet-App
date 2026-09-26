import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { menuSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { replaceMenu } from "@/lib/server/provider-portal";

/** PUT /api/provider/menu — services offered, with the vendor's own prices. */
export async function PUT(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { items } = menuSchema.parse(await request.json());
    await replaceMenu(auth.providerId, items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
