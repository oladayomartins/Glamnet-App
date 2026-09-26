import { NextResponse } from "next/server";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { startPayoutOnboarding } from "@/lib/server/provider-portal";

export const dynamic = "force-dynamic";

/**
 * GET /api/provider/payouts — send the vendor to Stripe Connect Express
 * onboarding to link their bank. Also Stripe's refresh_url, for a link that
 * expired mid-form.
 *
 * This is a page navigation, not an API call, so a failure must land the pro
 * back in the wizard with a message — never on a blank page of JSON. The
 * underlying reason is logged for us; the pro gets plain words.
 */
export async function GET(request: Request) {
  const back = new URL("/provider/onboarding", request.url);
  back.searchParams.set("step", "payouts");

  const auth = await requireApiVendor();
  if ("response" in auth) {
    return NextResponse.redirect(new URL("/sign-in/vendor?next=/provider/onboarding", request.url), 303);
  }

  try {
    const url = await startPayoutOnboarding(auth.providerId, new URL(request.url).origin);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error("Payout onboarding could not start", error);
    back.searchParams.set("payouts", "unavailable");
    return NextResponse.redirect(back, 303);
  }
}
