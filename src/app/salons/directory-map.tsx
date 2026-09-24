"use client";

import { MapView, type MapMarker } from "@/components/map-view";

/**
 * The directory's map. Vendors are pinned at the centre of their outward
 * code, never their address; pins sharing an area are fanned out a little
 * so each can be clicked.
 */
export function DirectoryMap({
  vendors,
  near,
}: {
  vendors: { id: string; slug: string; name: string; sector: string; area: { lat: number; lng: number } | null; priceLabel: string; isFeatured: boolean }[];
  near: { lat: number; lng: number; label: string } | null;
}) {
  const seen = new Map<string, number>();
  const markers: MapMarker[] = vendors.flatMap((vendor) => {
    if (!vendor.area) return [];
    const key = `${vendor.area.lat},${vendor.area.lng}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    const angle = index * 2.4;
    const spread = index === 0 ? 0 : 0.0025 * Math.sqrt(index);
    return [
      {
        id: vendor.id,
        lat: vendor.area.lat + spread * Math.sin(angle),
        lng: vendor.area.lng + spread * Math.cos(angle) * 1.6,
        label: vendor.name,
        sublabel: `${vendor.sector}${vendor.priceLabel ? ` · ${vendor.priceLabel}` : ""}`,
        href: `/pro/${vendor.slug}?via=directory`,
        highlight: vendor.isFeatured,
      },
    ];
  });

  const centre = near ?? markers[0] ?? { lat: 54.0, lng: -2.5 };
  return (
    <MapView
      label="Map of pros"
      center={centre}
      zoom={near ? 12 : markers.length ? 11 : 5}
      markers={markers}
      area={near ? { lat: near.lat, lng: near.lng, radiusM: 350 } : null}
      fitToMarkers={!near && markers.length > 1}
      className="h-72 lg:h-[26rem]"
    />
  );
}
