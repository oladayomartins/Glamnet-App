import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { feeConfigSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { feeConfigHistory, getFeeConfig, publishFeeRates } from "@/lib/server/fee-config";

export const dynamic = "force-dynamic";

/** GET /api/admin/fee-config — the commission and fee rates in force, and recent changes. */
export async function GET() {
  try {
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;
    const [current, history] = await Promise.all([getFeeConfig(), feeConfigHistory()]);
    return NextResponse.json({ current, history });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/fee-config — publish new commission and fee rates.
 *
 * Append-only: a new row is added and applies to bookings made from now on.
 * Bookings already made keep the rates they were made under. Admin only, and
 * every change is written to the audit log.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;
    const { note, ...rates } = feeConfigSchema.parse(await request.json());
    const config = await publishFeeRates(rates, auth.user.email, note);
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
