import { adForSlot, type AdSlot as Slot } from "@/lib/server/admin/marketing";

/**
 * A live ad for a named slot, or nothing.
 *
 * Clicks go through /api/ads/:id/click, which counts them and forwards to the
 * link stored against the ad. Labelled "Sponsored" so an ad is never mistaken
 * for an editorial pick.
 */
export async function AdSlot({ slot, className = "" }: { slot: Slot; className?: string }) {
  const ad = await adForSlot(slot);
  if (!ad) return null;

  const body = (
    <div className="relative flex min-h-28 items-end overflow-hidden rounded-glam-lg bg-metal">
      {ad.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageKit transform URL
        <img
          src={`${ad.imageUrl}?tr=w-1400,h-400,fo-auto`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className={`relative w-full p-5 ${ad.imageUrl ? "bg-gradient-to-t from-obsidian/85 via-obsidian/40 to-transparent text-on-obsidian" : "text-metal-ink"}`}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-75">Sponsored</span>
        <p className="font-display text-xl font-bold leading-tight">{ad.title}</p>
        {ad.subtitle ? <p className="mt-0.5 text-sm opacity-85">{ad.subtitle}</p> : null}
      </div>
    </div>
  );

  return (
    <aside aria-label="Sponsored" className={className}>
      {ad.hasLink ? (
        <a href={`/api/ads/${ad.id}/click`} rel="sponsored" className="block transition duration-[180ms] ease-glam hover:brightness-105">
          {body}
        </a>
      ) : (
        body
      )}
    </aside>
  );
}
