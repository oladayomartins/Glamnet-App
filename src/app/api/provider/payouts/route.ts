import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { startPayoutOnboarding } from "@/lib/server/provider-portal";

export const dynamic = "force-dynamic";

/**
 * GET /api/provider/payouts — send the vendor to Stripe Connect Express
 * onboarding to link their bank. Also Stripe's refresh_url, for a link that
 * expired mid-form.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const url = await startPayoutOnboarding(auth.providerId, new URL(request.url).origin);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return errorResponse(error);
  }
}
