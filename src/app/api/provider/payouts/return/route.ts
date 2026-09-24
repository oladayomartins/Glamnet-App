import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { refreshPayoutStatus } from "@/lib/server/provider-portal";

export const dynamic = "force-dynamic";

/** GET /api/provider/payouts/return — Stripe hands the vendor back here. */
export async function GET(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const ready = await refreshPayoutStatus(auth.providerId);
    const back = new URL("/provider/onboarding", request.url);
    back.searchParams.set("step", "payouts");
    back.searchParams.set("payouts", ready ? "ready" : "incomplete");
    return NextResponse.redirect(back, 303);
  } catch (error) {
    return errorResponse(error);
  }
}
