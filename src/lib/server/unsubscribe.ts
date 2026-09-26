import { prisma } from "./prisma";
import { siteUrl } from "@/lib/site";

/**
 * Marketing email opt-out.
 *
 * Every campaign email carries a link with the recipient's own random token,
 * so anyone can opt out in one step without signing in — the law (PECR)
 * requires a simple, free way to refuse in every marketing message. Only
 * campaigns are affected: booking, payment and account emails are part of
 * the service and keep coming.
 */

/** Tokens are UUIDs; anything else is refused without touching the database. */
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** The address one-click unsubscribe (RFC 8058) posts to. */
export function oneClickUrl(token: string): string {
  return `${siteUrl()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** Who a token belongs to, masked for display, and whether they're opted out. */
export async function subscriptionForToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const user = await prisma.appUser.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true, marketingOptOutAt: true },
  });
  if (!user) return null;
  return { email: maskEmail(user.email), optedOut: user.marketingOptOutAt !== null };
}

/** Opt out (or back in) by token. Returns false for an unknown token. */
export async function setOptOutByToken(token: string, optOut: boolean): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const result = await prisma.appUser.updateMany({
    where: { unsubscribeToken: token },
    data: { marketingOptOutAt: optOut ? new Date() : null },
  });
  return result.count > 0;
}

/** Opt a signed-in person out (or back in) from their account page. */
export async function setOptOutForUser(appUserId: string, optOut: boolean) {
  await prisma.appUser.update({
    where: { id: appUserId },
    data: { marketingOptOutAt: optOut ? new Date() : null },
  });
}

/** "j•••@gmail.com": enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your account";
  return `${local.slice(0, 1)}•••@${domain}`;
}
