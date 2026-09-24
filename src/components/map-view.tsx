"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Shown in the popup. */
  label: string;
  sublabel?: string;
  href?: string;
  /** Drawn larger, in full gold. */
  highlight?: boolean;
}

/**
 * An OpenStreetMap map (Leaflet), loaded only in the browser.
 *
 * Tiles default to OpenStreetMap's public server, which is fine for a young
 * site; set NEXT_PUBLIC_MAP_TILES_URL (and NEXT_PUBLIC_MAP_ATTRIBUTION) to a
 * tile provider's URL to move to one with a service agreement.
 *
 * Markers are brand pins drawn in CSS, so there are no marker images to host.
 * Scroll-wheel zoom is off: a map in the middle of a page must not trap the
 * page's own scrolling.
 */
export function MapView({
  center,
  zoom = 12,
  markers = [],
  area,
  fitToMarkers = false,
  className = "h-72",
  label = "Map",
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** A soft circle for an approximate area, in metres. */
  area?: { lat: number; lng: number; radiusM: number } | null;
  fitToMarkers?: boolean;
  className?: string;
  label?: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  // Everything the effect draws, as one comparable value.
  const signature = JSON.stringify({ center, zoom, markers, area, fitToMarkers });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !node.current) return;

      if (!map.current) {
        map.current = L.map(node.current, { scrollWheelZoom: false, attributionControl: true });
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 18,
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(map.current);
      }
      const leaflet = map.current;

      // Redraw overlays from scratch; the tile layer stays.
      leaflet.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) leaflet.removeLayer(layer);
      });

      if (area) {
        L.circle([area.lat, area.lng], {
          radius: area.radiusM,
          color: "#D9B061",
          weight: 2,
          fillColor: "#D9B061",
          fillOpacity: 0.18,
        }).addTo(leaflet);
      }

      const points: [number, number][] = [];
      for (const marker of markers) {
        const size = marker.highlight ? 34 : 26;
        const icon = L.divIcon({
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
          popupAnchor: [0, -size],
          html: `<span class="glam-map-pin${marker.highlight ? " glam-map-pin--hi" : ""}" style="width:${size}px;height:${size}px"></span>`,
        });
        const popup = document.createElement("div");
        const title = document.createElement(marker.href ? "a" : "strong");
        title.textContent = marker.label;
        if (marker.href) {
          (title as HTMLAnchorElement).href = marker.href;
          title.className = "glam-map-link";
        }
        popup.appendChild(title);
        if (marker.sublabel) {
          const sub = document.createElement("div");
          sub.textContent = marker.sublabel;
          sub.className = "glam-map-sub";
          popup.appendChild(sub);
        }
        L.marker([marker.lat, marker.lng], { icon, title: marker.label, keyboard: true })
          .bindPopup(popup)
          .addTo(leaflet);
        points.push([marker.lat, marker.lng]);
      }

      if (fitToMarkers && points.length > 1) {
        leaflet.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 14 });
      } else {
        leaflet.setView([center.lat, center.lng], zoom);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw when the signature changes
  }, [signature]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div
      ref={node}
      role="region"
      aria-label={label}
      className={`relative z-0 w-full overflow-hidden rounded-glam border border-line bg-sunken ${className}`}
    />
  );
}
