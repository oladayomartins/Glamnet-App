import { adsForSlot, type AdSlot as Slot, type LiveAd } from "@/lib/server/admin/marketing";
import { AdView } from "./ad-view";

/**
 * The live ad for a named slot, or nothing.
 *
 * Usually one ad; two when a phones-only and a computers-only ad share the
 * slot, each shown only on its own kind of screen. Clicks go through
 * /api/ads/:id/click, which counts them and forwards to the stored link.
 */
export async function AdSlot({ slot, city, className = "" }: { slot: Slot; city?: string | null; className?: string }) {
  const ads = await adsForSlot(slot, { city });
  return <AdList ads={ads} className={className} />;
}

/** Ads already looked up, e.g. an in-list slot whose position comes from the ad. */
export function AdList({ ads, className = "" }: { ads: LiveAd[]; className?: string }) {
  if (ads.length === 0) return null;
  return (
    <>
      {ads.map((ad) => (
        <AdView key={`${ad.id}:${ad.device}`} {...ad} className={className} />
      ))}
    </>
  );
}
