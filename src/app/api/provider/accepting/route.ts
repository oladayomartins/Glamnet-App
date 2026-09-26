import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { acceptingSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { setAcceptingWork } from "@/lib/server/provider-portal";

/** POST /api/provider/accepting — the vacation toggle. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { accepting } = acceptingSchema.parse(await request.json());
    const provider = await setAcceptingWork(auth.providerId, accepting);
    return NextResponse.json({ accepting: provider.isAcceptingWork });
  } catch (error) {
    return errorResponse(error);
  }
}
