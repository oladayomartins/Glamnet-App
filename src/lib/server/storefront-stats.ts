import { prisma } from "./prisma";
import { getSessionUser } from "@/lib/auth/session";
import { isBot, statDay, summariseStats, type StatSource } from "@/lib/domain/storefront-stats";

/**
 * Count one storefront view. Nothing about the visitor is stored — only the
 * day's total goes up. The vendor's own visits and admins are left out, so
 * the number means other people.
 */
export async function recordStorefrontView(
  slug: string,
  source: StatSource,
  userAgent: string | null,
  now = new Date(),
): Promise<void> {
  if (isBot(userAgent)) return;
  const provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
  if (!provider) return;
  const viewer = await getSessionUser().catch(() => null);
  if (viewer && (viewer.role === "ADMIN" || viewer.providerId === provider.id)) return;

  const day = statDay(now);
  await prisma.storefrontDailyStat.upsert({
    where: { providerId_day_source: { providerId: provider.id, day, source } },
    create: { providerId: provider.id, day, source, views: 1 },
    update: { views: { increment: 1 } },
  });
}

/** The vendor's stats for the last `dayCount` UK days, today included. */
export async function storefrontStats(providerId: string, dayCount: number, now = new Date()) {
  const from = statDay(new Date(now.getTime() - (dayCount - 1) * 86_400_000));
  const [views, bookings] = await Promise.all([
    prisma.storefrontDailyStat.findMany({
      where: { providerId, day: { gte: from } },
      select: { day: true, source: true, views: true },
    }),
    prisma.booking.findMany({
      where: {
        providerId,
        source: { in: ["DIRECT_LINK", "MARKETPLACE"] },
        bookingCreatedAt: { gte: new Date(from.getTime() - 86_400_000) },
        // A checkout abandoned before the card went in is not a booking.
        NOT: { status: "ACCEPTED", paymentStatus: "PENDING_AUTHORISATION" },
      },
      select: { bookingCreatedAt: true, source: true, status: true, providerPayoutMinor: true },
    }),
  ]);
  return summariseStats({
    views,
    bookings: bookings.map((booking) => ({
      createdAt: booking.bookingCreatedAt,
      source: booking.source,
      status: booking.status,
      payoutMinor: booking.providerPayoutMinor,
    })),
    from,
    dayCount,
  });
}
