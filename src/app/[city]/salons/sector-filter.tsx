"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, MapPin } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { nearestSector, normaliseSector } from "@/lib/domain/postcode";

/**
 * Postcode sector filtering widget: type "S10" (or a full postcode), or use
 * the phone's location to find the nearest sector. The coordinates never
 * leave the browser — only the resulting sector goes into the URL.
 */
export function SectorFilter({
  current,
  basePath,
  hub,
}: {
  current: string | null;
  basePath: string;
  hub: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const go = (sector: string | null) => {
    const search = new URLSearchParams();
    if (hub) search.set("hub", hub);
    if (sector) search.set("sector", sector);
    const text = search.toString();
    router.push(`${basePath}${text ? `?${text}` : ""}`);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return go(null);
    const sector = normaliseSector(value);
    if (!sector) {
      setMessage("Enter a Sheffield postcode, like S10 or S11 8HN.");
      return;
    }
    setMessage(null);
    setValue(sector);
    go(sector);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setMessage("Your browser cannot share its location. Type your postcode instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const sector = nearestSector({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
        setMessage(null);
        setValue(sector);
        go(sector);
      },
      () => {
        setLocating(false);
        setMessage("We could not get your location. Type your postcode instead.");
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2" role="search">
      <label className="block flex-1 basis-48">
        <span className="text-sm font-medium text-ink">Your postcode sector</span>
        <span className="relative mt-1 block">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="S10"
            autoComplete="postal-code"
            className="min-h-11 w-full rounded-glam-input border border-line bg-surface pl-9 pr-3 text-[15px] uppercase text-ink outline-none focus:border-accent-500"
          />
        </span>
      </label>
      <Button type="submit">Sort by distance</Button>
      <Button type="button" variant="secondary" onClick={locate} disabled={locating}>
        <Crosshair size={16} aria-hidden />
        {locating ? "Locating…" : "Use my location"}
      </Button>
      {message ? (
        <p role="alert" className="basis-full text-sm text-warning">
          {message}
        </p>
      ) : null}
    </form>
  );
}
