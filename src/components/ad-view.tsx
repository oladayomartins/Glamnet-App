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

/** Where a text-only ad's headline sits. */
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

  // An image ad is the picture alone: its words are in the artwork. The ad's
  // name is only its description for screen readers. Text appears on the ad
  // itself only when there is no image, since then the words are the ad.
  const placement = imageUrl ? null : TEXT_PLACEMENT[textPosition === "HIDDEN" ? "BOTTOM_LEFT" : textPosition];

  const body = (
    <div
      style={adBoxStyle(props)}
      className={`relative flex overflow-hidden rounded-glam-lg bg-metal ${placement ? `min-h-28 ${placement}` : ""}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageKit transform URL
        <img
          src={adImageSrc(imageUrl, props)}
          alt={title}
          className={`absolute inset-0 h-full w-full ${imageFit === "CONTAIN" ? "object-contain" : "object-cover"}`}
        />
      ) : null}
      {placement ? (
        <div className="relative w-full p-5 text-metal-ink">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-75">Sponsored</span>
          <p className="font-display text-xl font-bold leading-tight">{title}</p>
          {subtitle ? <p className="mt-0.5 text-sm opacity-85">{subtitle}</p> : null}
        </div>
      ) : (
        // Ads must be recognisable as ads (CAP Code 2.1), so even a picture-only
        // ad carries a small label, tucked into the corner.
        <span className="absolute bottom-1.5 left-3 rounded-full bg-obsidian/70 px-2 py-0.5 font-mono text-[9px] uppercase leading-tight tracking-[0.14em] text-on-obsidian backdrop-blur-sm">
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
