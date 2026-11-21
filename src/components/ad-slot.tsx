import { adsForSlot, type AdSlot as Slot, type LiveAd } from "@/lib/server/admin/marketing";
import { slideshows } from "@/lib/domain/ad-layout";
import { AdCarousel } from "./ad-carousel";
import { AdView } from "./ad-view";

/**
 * The live ads for a named slot, or nothing.
 *
 * One ad shows on its own; several slide in turn. When phones-only or
 * computers-only ads share the slot, each kind of screen gets its own
 * slideshow. Clicks go through /api/ads/:id/click, which counts them and
 * forwards to the stored link.
 */
export async function AdSlot({ slot, city, className = "" }: { slot: Slot; city?: string | null; className?: string }) {
  const ads = await adsForSlot(slot, { city });
  return <AdList ads={ads} className={className} />;
}

/** Ads already looked up, e.g. an in-list slot whose position comes from the ad. */
export function AdList({ ads, className = "" }: { ads: LiveAd[]; className?: string }) {
  return (
    <>
      {slideshows(ads).map((show) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- not an AdView prop
        const slides = show.ads.map(({ listPosition, device, ...ad }) => ad);
        return slides.length === 1 ? (
          <AdView key={`${slides[0].id}:${show.device}`} {...slides[0]} device={show.device} className={className} />
        ) : (
          <AdCarousel key={`${show.device}:${slides.map((ad) => ad.id).join(",")}`} ads={slides} device={show.device} className={className} />
        );
      })}
    </>
  );
}
