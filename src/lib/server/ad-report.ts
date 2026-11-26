import { prisma } from "./prisma";
import { AD_SLOTS, type AdSlot } from "@/lib/domain/ad-layout";
import { buildAdReport, type AdReport } from "@/lib/domain/ad-report";
import { scheduleOf } from "./admin/core";

export interface SharedAdReport {
  name: string;
  advertiser: string;
  placement: string;
  imageUrl: string;
  linkUrl: string;
  startsAt: Date;
  endsAt: Date | null;
  schedule: ReturnType<typeof scheduleOf>;
  report: AdReport;
}

/**
 * An ad's performance report, found by the secret in its share link. Anyone
 * holding the link can see it, so it carries the ad's own numbers and
 * nothing about other ads or the site.
 */
export async function adReportByToken(token: string): Promise<SharedAdReport | null> {
  // Tokens are UUIDs; anything else cannot match, so skip the query.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const ad = await prisma.adPlacement.findUnique({
    where: { reportToken: token },
    include: { daily: { orderBy: { day: "asc" } } },
  });
  if (!ad) return null;
  return {
    name: ad.title,
    advertiser: ad.advertiser,
    placement: AD_SLOTS[ad.slot as AdSlot]?.label ?? ad.slot,
    imageUrl: ad.imageUrl,
    linkUrl: ad.linkUrl,
    startsAt: ad.startsAt,
    endsAt: ad.endsAt,
    schedule: scheduleOf(ad),
    report: buildAdReport(ad, ad.daily),
  };
}
