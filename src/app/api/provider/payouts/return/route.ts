import { NextResponse } from "next/server";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { refreshPayoutStatus } from "@/lib/server/provider-portal";

export const dynamic = "force-dynamic";

/**
 * GET /api/provider/payouts/return — Stripe hands the vendor back here.
 *
 * Like /api/provider/payouts this is a page navigation, so every outcome,
 * including an expired session or a Stripe error, lands the pro back in the
 * wizard with a message rather than on a page of raw JSON.
 */
export async function GET(request: Request) {
  const back = new URL("/provider/onboarding", request.url);
  back.searchParams.set("step", "payouts");

  const auth = await requireApiVendor();
  if ("response" in auth) {
    return NextResponse.redirect(new URL("/sign-in/vendor?next=/provider/onboarding", request.url), 303);
  }

  try {
    const ready = await refreshPayoutStatus(auth.providerId);
    back.searchParams.set("payouts", ready ? "ready" : "incomplete");
  } catch (error) {
    console.error("Payout status could not be refreshed", error);
    back.searchParams.set("payouts", "unavailable");
  }
  return NextResponse.redirect(back, 303);
}
