"use client";

import { useEffect, useRef } from "react";
import {
  adBoxStyle,
  adImageSrc,
  deviceClass,
  type AdAlign,
  type AdDevice,
  type AdFit,
  type AdTextPosition,
} from "@/lib/domain/ad-layout";

export interface AdViewProps {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  hasLink: boolean;
  width: number;
  height: number;
  align: AdAlign;
  textPosition: AdTextPosition;
  imageFit: AdFit;
  device: AdDevice;
  /** The admin editor's preview: no link, no view counted, always shown. */
  preview?: boolean;
  className?: string;
}

/**
 * Where the caption sits. It is kept small so it never covers the artwork —
 * most ads carry their own words in the image — and the "Sponsored" label
 * always shows.
 */
const TEXT_PLACEMENT: Record<Exclude<AdTextPosition, "HIDDEN">, string> = {
  BOTTOM_LEFT: "items-end justify-start text-left",
  BOTTOM_CENTER: "items-end justify-center text-center",
  CENTER: "items-center justify-center text-center",
  TOP_LEFT: "items-start justify-start text-left",
};

/**
 * One ad, drawn at the size and position an admin chose.
 *
 * Counts a view once at least half of it has been on screen, so an ad hidden
 * on this device (display: none never intersects) or never scrolled to is not
 * counted. Labelled "Sponsored" whatever the layout, so an ad is never
 * mistaken for an editorial pick, including one whose headline is hidden.
 */
export function AdView(props: AdViewProps) {
  const { id, title, subtitle, imageUrl, hasLink, textPosition, imageFit, device, preview, className = "" } = props;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (preview || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const url = `/api/ads/${id}/view`;
        if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, preview]);

  // Words over nothing need to be shown, whatever was chosen.
  const shown = textPosition === "HIDDEN" ? "BOTTOM_LEFT" : textPosition;
  // Over an image the caption is always tucked into the bottom-left corner,
  // out of the artwork's way.
  const placement =
    textPosition === "HIDDEN" && imageUrl ? null : TEXT_PLACEMENT[imageUrl ? "BOTTOM_LEFT" : shown];

  const body = (
    <div
      style={adBoxStyle(props)}
      className={`relative flex overflow-hidden rounded-glam-lg bg-metal ${placement && !imageUrl ? "min-h-28" : ""} ${placement ?? ""}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageKit transform URL
        <img
          src={adImageSrc(imageUrl, props)}
          alt={placement ? "" : title}
          className={`absolute inset-0 h-full w-full ${imageFit === "CONTAIN" ? "object-contain" : "object-cover"}`}
        />
      ) : null}
      {placement && imageUrl ? (
        // A small caption chip over the artwork, not a headline across it.
        <div className="relative mb-1.5 ml-3 max-w-[70%] rounded-full bg-obsidian/70 px-2 py-0.5 text-on-obsidian backdrop-blur-sm">
          <p className="truncate text-[9px] leading-tight">
            <span className="font-mono uppercase tracking-[0.14em] opacity-75">Sponsored</span>
            {title ? <span className="font-semibold"> · {title}</span> : null}
          </p>
        </div>
      ) : placement ? (
        // No image: the words are the ad, so they stay readable.
        <div className="relative w-full p-5 text-metal-ink">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-75">Sponsored</span>
          <p className="font-display text-xl font-bold leading-tight">{title}</p>
          {subtitle ? <p className="mt-0.5 text-sm opacity-85">{subtitle}</p> : null}
        </div>
      ) : (
        <span className="absolute right-2 top-2 rounded-full bg-obsidian/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-on-obsidian">
          Sponsored
        </span>
      )}
    </div>
  );

  return (
    <aside ref={ref} aria-label="Sponsored" className={`${preview ? "" : deviceClass(device)} ${className}`.trim()}>
      {hasLink && !preview ? (
        <a href={`/api/ads/${id}/click`} rel="sponsored" className="block transition duration-[180ms] ease-glam hover:brightness-105">
          {body}
        </a>
      ) : (
        body
      )}
    </aside>
  );
}
