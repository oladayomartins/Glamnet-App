import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { isPushConfigured, pushToUsers } from "@/lib/server/push";

/**
 * The browser's PushSubscription, as `subscription.toJSON()` gives it.
 * The endpoint must be a push service over https — nothing else is ever
 * posted to.
 */
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1_000).refine((url) => url.startsWith("https://"), "Must be https."),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

const ALL_ROLES = ["CUSTOMER", "PROVIDER", "ADMIN"] as const;

/**
 * POST /api/push/subscribe — turn on push for this device. Re-subscribing
 * the same browser (same endpoint) moves it to whoever is signed in now, so
 * a shared device never keeps pushing to the previous account.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole([...ALL_ROLES]);
    if ("response" in auth) return auth.response;
    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: { code: "PUSH_NOT_CONFIGURED", message: "Notifications aren't set up on this site yet." } },
        { status: 503 },
      );
    }
    const input = subscriptionSchema.parse(await request.json());
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        appUserId: auth.user.appUserId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
      },
      update: { appUserId: auth.user.appUserId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
    });
    // A first notification straight away, so the person sees it works.
    await pushToUsers([auth.user.appUserId], {
      title: "Notifications are on",
      body:
        auth.user.role === "PROVIDER"
          ? "You'll hear about new booking requests here, even with GLAMNET closed."
          : "We'll let you know here when something changes with your booking.",
      url: auth.user.role === "PROVIDER" ? "/provider" : "/account",
      tag: "welcome",
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/push/subscribe — turn push off for this device. */
export async function DELETE(request: Request) {
  try {
    const auth = await requireApiRole([...ALL_ROLES]);
    if ("response" in auth) return auth.response;
    const { endpoint } = z.object({ endpoint: z.string().max(1_000) }).parse(await request.json());
    await prisma.pushSubscription.deleteMany({ where: { endpoint, appUserId: auth.user.appUserId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
