import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { completeOnboarding } from "@/lib/server/provider-portal";

/** POST /api/provider/onboarding — submit the finished wizard for review. */
export async function POST() {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    await completeOnboarding(auth.providerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
