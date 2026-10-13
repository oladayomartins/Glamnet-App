import { NextResponse } from "next/server";
import { calendarFeed } from "@/lib/server/calendar-feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/:token.ics — a vendor's diary as an iCalendar feed, for
 * Google, Apple or Outlook to subscribe to. No sign-in: calendar apps can't
 * sign in, so the long random token in the link is the key. An unknown or
 * revoked token is a plain 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const feed = await calendarFeed(token.replace(/\.ics$/i, ""));
  if (feed === null) {
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(feed, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="glamnet.ics"',
      // Fresh on every fetch: a moved or cancelled booking should show up the
      // next time the calendar looks. Never cached by anything in between.
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
