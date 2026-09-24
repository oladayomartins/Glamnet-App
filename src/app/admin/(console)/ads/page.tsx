import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AD_SLOTS } from "@/lib/server/admin/marketing";
import { scheduleOf } from "@/lib/server/admin/core";
import { AdminHeader } from "../_components/bits";
import { AdManager } from "./ad-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ad placements" };

/** Sponsored slots on the home page, directory and storefronts. */
export default async function AdminAdsPage() {
  await requireRole("ADMIN", "/admin/ads");
  const ads = await prisma.adPlacement.findMany({ orderBy: [{ slot: "asc" }, { priority: "desc" }, { createdAt: "desc" }] });

  return (
    <div>
      <AdminHeader
        title="Ad placements"
        lede="Sell or give away sponsored space. Each slot shows its highest-priority live ad, and ads with equal priority take turns. Views and clicks are counted."
      />
      <AdManager
        slots={Object.entries(AD_SLOTS).map(([key, value]) => ({ key, ...value }))}
        ads={ads.map((ad) => ({
          id: ad.id,
          slot: ad.slot,
          title: ad.title,
          subtitle: ad.subtitle,
          imageUrl: ad.imageUrl,
          imageFileId: ad.imageFileId,
          linkUrl: ad.linkUrl,
          advertiser: ad.advertiser,
          startsAt: ad.startsAt.toISOString(),
          endsAt: ad.endsAt?.toISOString() ?? null,
          isActive: ad.isActive,
          priority: ad.priority,
          impressions: ad.impressions,
          clicks: ad.clicks,
          schedule: scheduleOf(ad),
        }))}
      />
    </div>
  );
}
