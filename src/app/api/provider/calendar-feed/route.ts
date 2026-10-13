import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { feedUrls, issueCalendarToken, revokeCalendarToken } from "@/lib/server/calendar-feed";

export const dynamic = "force-dynamic";

/**
 * POST /api/provider/calendar-feed — turn calendar sync on, or reset its link
 * (every calendar using the old link stops updating). Returns the new links.
 */
export async function POST() {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const token = await issueCalendarToken(auth.providerId);
    return NextResponse.json({ urls: feedUrls(token) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/provider/calendar-feed — turn calendar sync off. */
export async function DELETE() {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    await revokeCalendarToken(auth.providerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
