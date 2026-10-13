import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { isPushConfigured, pushToUsers } from "@/lib/server/push";

/**
 * POST /api/push/test — send yourself a test notification, to check that a
 * device really receives them. Says how many devices it went to, so "0"
 * points at a subscription that has lapsed.
 */
export async function POST() {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: { code: "PUSH_NOT_CONFIGURED", message: "Notifications aren't set up on this site yet." } },
        { status: 503 },
      );
    }
    const sent = await pushToUsers([auth.user.appUserId], {
      title: "Test from GLAMNET",
      body: "If you can see this, notifications are working on this device.",
      url: "/install",
      tag: "test",
    });
    return NextResponse.json({ sent });
  } catch (error) {
    return errorResponse(error);
  }
}
