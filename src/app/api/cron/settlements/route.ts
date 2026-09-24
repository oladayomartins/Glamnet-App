import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { closeExpiredDisputeWindows } from "@/lib/server/escrow";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/settlements — mark every booking past its 24-hour dispute
 * window as closed_uncontestable.
 *
 * Run by Vercel Cron (vercel.json), which sends `Authorization: Bearer
 * $CRON_SECRET`. Without CRON_SECRET set the route refuses everything rather
 * than running open to the internet. The lockout itself does not depend on
 * this job — pages and the dispute API check the timestamp directly — so a
 * missed run only delays the stored status, never the rule.
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Not allowed." } },
        { status: 401 },
      );
    }
    const closed = await closeExpiredDisputeWindows();
    return NextResponse.json({ closed });
  } catch (error) {
    return errorResponse(error);
  }
}
