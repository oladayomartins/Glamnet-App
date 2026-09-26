"use client";

import { useRef, useState } from "react";
import { ArrowsOut, X } from "@phosphor-icons/react";
import { MapView } from "@/components/map-view";

/**
 * The vendor's area as a still picture that opens a full map when tapped.
 * An interactive map mid-page catches the swipes meant to scroll the page,
 * and its zoom buttons sit right under a thumb.
 */
export function AreaMap({
  center,
  label,
}: {
  center: { lat: number; lng: number };
  label: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The full map mounts only while open: Leaflet sizes itself on creation,
  // and inside a closed dialog it would measure 0×0.
  const [open, setOpen] = useState(false);
  const area = { ...center, radiusM: 1_000 };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        className="relative block w-full text-left"
        aria-label={`Open the full map of ${label}`}
      >
        <MapView label={label} center={center} zoom={13} area={area} className="pointer-events-none h-48" interactive={false} />
        <span className="absolute bottom-3 right-3 z-[500] inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-card">
          <ArrowsOut size={16} aria-hidden />
          Open map
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-label={label}
        className="m-auto h-[85dvh] w-[min(100vw-2rem,48rem)] max-w-none overflow-hidden rounded-glam bg-surface p-0 text-ink backdrop:bg-obsidian/60"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A tap on the backdrop closes it.
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="relative h-full">
          {open ? (
            <MapView label={label} center={center} zoom={14} area={area} className="h-full rounded-none border-0" />
          ) : null}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close map"
            className="absolute right-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-card"
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>
      </dialog>
    </>
  );
}
