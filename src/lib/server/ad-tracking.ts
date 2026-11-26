import { prisma } from "./prisma";
import { ukDay } from "@/lib/domain/ad-report";

/**
 * Count a view or click of an ad: on the ad's lifetime total and on today's
 * row for its report. Returns the ad's link, or null when the ad is gone.
 */
export async function countAd(id: string, kind: "impressions" | "clicks"): Promise<{ linkUrl: string } | null> {
  const day = ukDay(new Date());
  const [ad] = await prisma.$transaction([
    prisma.adPlacement.update({ where: { id }, data: { [kind]: { increment: 1 } }, select: { linkUrl: true } }),
    prisma.adDailyStat.upsert({
      where: { adId_day: { adId: id, day } },
      create: { adId: id, day, [kind]: 1 },
      update: { [kind]: { increment: 1 } },
    }),
  ]).catch((cause: { code?: string }) => {
    // P2025: no such ad (deleted, or a made-up id). Not worth an error.
    if (cause?.code === "P2025" || cause?.code === "P2003") return [null];
    throw cause;
  });
  return ad;
}
