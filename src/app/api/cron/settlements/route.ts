import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { closeExpiredDisputeWindows } from "@/lib/server/escrow";
import { runPaymentSweep } from "@/lib/server/payment-flow";
import { sendCancellationReminders } from "@/lib/server/cancellations";
import { retryHeldPayouts } from "@/lib/server/held-payouts";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/settlements — the daily money job:
 *   - mark every booking past its 24-hour dispute window closed_uncontestable;
 *   - hold saved cards for bookings now within five days;
 *   - cancel bookings still without a card a day before;
 *   - release holds on abandoned checkouts and unanswered broadcasts;
 *   - remind customers the day before free cancellation ends;
 *   - retry payouts still held for verified vendors (a refused transfer, a
 *     dispute since ruled, or a bank that started working unnoticed).
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
    const payments = await runPaymentSweep();
    const reminders = await sendCancellationReminders();
    const heldPayouts = await retryHeldPayouts();
    return NextResponse.json({ closed, payments, reminders, heldPayouts });
  } catch (error) {
    return errorResponse(error);
  }
}
