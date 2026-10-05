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

const TEXT_PLACEMENT: Record<Exclude<AdTextPosition, "HIDDEN">, { box: string; shade: string }> = {
  BOTTOM_LEFT: { box: "items-end justify-start text-left", shade: "bg-gradient-to-t from-obsidian/85 via-obsidian/40 to-transparent" },
  BOTTOM_CENTER: { box: "items-end justify-center text-center", shade: "bg-gradient-to-t from-obsidian/85 via-obsidian/40 to-transparent" },
  CENTER: { box: "items-center justify-center text-center", shade: "bg-obsidian/45" },
  TOP_LEFT: { box: "items-start justify-start text-left", shade: "bg-gradient-to-b from-obsidian/85 via-obsidian/40 to-transparent" },
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
  const placement = textPosition === "HIDDEN" && imageUrl ? null : TEXT_PLACEMENT[textPosition === "HIDDEN" ? "BOTTOM_LEFT" : textPosition];

  const body = (
    <div
      style={adBoxStyle(props)}
      className={`relative flex overflow-hidden rounded-glam-lg bg-metal ${placement ? "min-h-28" : ""} ${placement?.box ?? ""}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageKit transform URL
        <img
          src={adImageSrc(imageUrl, props)}
          alt={placement ? "" : title}
          className={`absolute inset-0 h-full w-full ${imageFit === "CONTAIN" ? "object-contain" : "object-cover"}`}
        />
      ) : null}
      {placement ? (
        <div className={`relative w-full p-5 ${imageUrl ? `${placement.shade} text-on-obsidian` : "text-metal-ink"}`}>
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
