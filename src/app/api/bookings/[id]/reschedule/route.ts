import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { rescheduleSchema } from "@/lib/api/schemas";
import { parseQueryDate } from "@/lib/api/parse-date";
import { requireApiRole } from "@/lib/auth/api-guard";
import { partyOf } from "@/lib/api/booking-party";
import { BookingError } from "@/lib/server/booking-service";
import { answerReschedule, proposeReschedule, rescheduleDays, rescheduleSlots } from "@/lib/server/reschedule";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/:id/reschedule — the days a new time could go on, or,
 * with ?date=YYYY-MM-DD, the free start times that day.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER"]);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const raw = new URL(request.url).searchParams.get("date");
    if (raw === null) {
      return NextResponse.json({ days: await rescheduleDays(id, partyOf(auth.user)) });
    }
    const date = parseQueryDate(raw);
    if (!date) throw new BookingError("Choose a day as YYYY-MM-DD.", "INVALID_TRANSITION", 422);
    return NextResponse.json({ slots: await rescheduleSlots(id, partyOf(auth.user), date) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/bookings/:id/reschedule — suggest a new time, or accept or
 * decline the one waiting. The booking only moves when the other side accepts.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER"]);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const party = partyOf(auth.user);
    const input = rescheduleSchema.parse(await request.json());
    if (input.action === "propose") await proposeReschedule(id, party, new Date(input.startAt));
    else await answerReschedule(id, party, input.action === "accept");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
