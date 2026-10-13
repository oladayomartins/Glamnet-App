"use client";

import { useEffect } from "react";

/** Page loads already counted, so a re-run effect (React may run one twice) counts once. */
const counted = new Set<string>();

/**
 * Counts this storefront visit for the vendor's stats, once per page load.
 * A beacon so it never delays the page or blocks leaving it.
 */
export function StorefrontViewBeacon({ slug, viaDirectory }: { slug: string; viaDirectory: boolean }) {
  useEffect(() => {
    const url = `/api/pro/${encodeURIComponent(slug)}/view?source=${viaDirectory ? "directory" : "link"}`;
    // One count per page load: keyed on the navigation's start time as well
    // as the storefront, so going to another storefront still counts.
    const key = `${url}@${performance.timeOrigin}:${history.length}:${location.href}`;
    if (counted.has(key)) return;
    counted.add(key);
    try {
      if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      // A missed count is fine.
    }
  }, [slug, viaDirectory]);
  return null;
}
