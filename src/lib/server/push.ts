import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Web Push: notifications on a locked phone or a closed laptop.
 *
 * Every Notification row the app writes (booking requests, "your PIN is
 * ready", card problems, dispute outcomes…) is also pushed to the devices its
 * recipient has turned notifications on for. That happens automatically, from
 * the database client (see prisma.ts), after the response is sent — so a
 * transaction that rolls back never pushes, and a slow push service never
 * slows a booking down.
 *
 * Needs a VAPID key pair: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and
 * VAPID_SUBJECT (a mailto: address). Without them push is simply off.
 */

export function vapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

let configured = false;
function configure(): boolean {
  if (!isPushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT?.trim() || "mailto:hello@glamnetapp.com",
      vapidPublicKey(),
      process.env.VAPID_PRIVATE_KEY!.trim(),
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification opens. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
  /** Stays on screen until dismissed (emergency requests). */
  urgent?: boolean;
}

/** Send one payload to every device these people have enabled. */
export async function pushToUsers(appUserIds: string[], payload: PushPayload): Promise<number> {
  if (appUserIds.length === 0 || !configure()) return 0;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { appUserId: { in: [...new Set(appUserIds)] } },
  });
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          // A booking request is worthless after its acceptance window.
          { TTL: payload.urgent ? 60 * 10 : 60 * 60 * 24, urgency: payload.urgent ? "high" : "normal" },
        );
        sent += 1;
        await prisma.pushSubscription
          .update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // Gone for good: the person turned notifications off or reinstalled.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        } else {
          console.error("[push] send failed", status, (error as Error).message);
        }
      }
    }),
  );
  return sent;
}

/**
 * Push the given Notification rows to their recipients. Rows that don't exist
 * (their transaction rolled back) are skipped.
 */
export async function pushForNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0 || !isPushConfigured()) return;
  const rows = await prisma.notification.findMany({
    where: { id: { in: ids } },
    include: {
      booking: {
        select: {
          id: true,
          customer: { select: { appUserId: true } },
        },
      },
    },
  });
  if (rows.length === 0) return;

  const providerIds = [...new Set(rows.map((row) => row.providerId).filter((id): id is string => Boolean(id)))];
  const providers = providerIds.length
    ? await prisma.provider.findMany({ where: { id: { in: providerIds } }, select: { id: true, appUserId: true } })
    : [];
  const providerUser = new Map(providers.map((provider) => [provider.id, provider.appUserId]));
  const needsAdmins = rows.some((row) => row.audience === "ADMIN");
  const admins = needsAdmins
    ? (await prisma.appUser.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((user) => user.id)
    : [];

  for (const row of rows) {
    const urgent = row.bookingType === "EMERGENCY";
    const payload = (url: string): PushPayload => ({
      title: row.title,
      body: row.body,
      url,
      tag: `${row.audience.toLowerCase()}-${row.bookingId}`,
      urgent,
    });
    if (row.audience === "CUSTOMER" && row.booking.customer.appUserId) {
      await pushToUsers([row.booking.customer.appUserId], payload(`/bookings/${row.bookingId}`));
    } else if (row.audience === "PROVIDER" && row.providerId) {
      const user = providerUser.get(row.providerId);
      // A broadcast is answered from the dashboard; anything else about a
      // vendor's own job opens that job.
      const url = /request/i.test(row.title) ? "/provider" : `/bookings/${row.bookingId}`;
      if (user) await pushToUsers([user], payload(url));
    } else if (row.audience === "ADMIN") {
      await pushToUsers(admins, payload(`/admin/bookings/${row.bookingId}`));
    }
  }
}
