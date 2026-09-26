import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { setOptOutForUser } from "@/lib/server/unsubscribe";

const schema = z.object({ subscribed: z.boolean() });

/** POST /api/account/marketing — turn news and offers emails on or off. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    const { subscribed } = schema.parse(await request.json());
    await setOptOutForUser(auth.user.appUserId, !subscribed);
    return NextResponse.json({ ok: true, subscribed });
  } catch (error) {
    return errorResponse(error);
  }
}
