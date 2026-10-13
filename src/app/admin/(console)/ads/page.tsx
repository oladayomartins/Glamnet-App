import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AD_SLOTS } from "@/lib/domain/ad-layout";
import { scheduleOf } from "@/lib/server/admin/core";
import { AdminHeader } from "../_components/bits";
import { AdManager, type Ad } from "./ad-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ad placements" };

/** Sponsored slots on the home page, directory and storefronts. */
export default async function AdminAdsPage() {
  await requireRole("ADMIN", "/admin/ads");
  const [ads, cities, hubCities] = await Promise.all([
    prisma.adPlacement.findMany({ orderBy: [{ slot: "asc" }, { priority: "desc" }, { createdAt: "desc" }] }),
    prisma.city.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.hub.findMany({ distinct: ["city"], select: { city: true } }),
  ]);
  // Cities from the home page tiles and from wherever vendors actually are.
  const cityNames = [...new Set([...cities.map((city) => city.name), ...hubCities.map((hub) => hub.city)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <AdminHeader
        title="Ad placements"
        lede="Sell or give away sponsored space. Choose where each ad goes, its size and layout, and who sees it. A slot shows its highest-priority live ad; ads of equal priority take turns. Views are counted when an ad is actually on screen."
      />
      <AdManager
        slots={Object.entries(AD_SLOTS).map(([key, value]) => ({ key, ...value }))}
        cities={cityNames}
        ads={ads.map(
          (ad): Ad => ({
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
            size: ad.size as Ad["size"],
            width: ad.width,
            height: ad.height,
            align: ad.align as Ad["align"],
            textPosition: ad.textPosition as Ad["textPosition"],
            imageFit: ad.imageFit as Ad["imageFit"],
            device: ad.device as Ad["device"],
            listPosition: ad.listPosition,
            targetCity: ad.targetCity,
            schedule: scheduleOf(ad),
          }),
        )}
      />
    </div>
  );
}
