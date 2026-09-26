import { NextResponse } from "next/server";
import { setOptOutByToken } from "@/lib/server/unsubscribe";

/**
 * POST /api/unsubscribe?t=<token> — opt out of marketing email.
 *
 * Two callers: the confirm button on /unsubscribe, and mail apps' one-click
 * unsubscribe (RFC 8058), which POSTs "List-Unsubscribe=One-Click" with no
 * cookies. The token is the only credential either needs. `resubscribe=1`
 * undoes it, for someone who clicked by mistake.
 *
 * Only POST changes anything: link scanners and prefetchers issue GETs, and
 * must never unsubscribe people by following the link.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const resubscribe = url.searchParams.get("resubscribe") === "1";
  const ok = await setOptOutByToken(token, !resubscribe);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "That unsubscribe link isn't valid." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, subscribed: resubscribe });
}
