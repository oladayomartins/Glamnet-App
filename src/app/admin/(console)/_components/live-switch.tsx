"use client";

import { useState } from "react";

/**
 * One-click on/off for anything the site shows or hides: categories, cities,
 * services, campaigns, ads, promo codes.
 *
 * Flips the moment it is pressed and holds that position while the change
 * saves; if the save fails, `on` never changes and the switch falls back to it
 * when `busy` clears.
 */
export function LiveSwitch({
  on,
  busy,
  onToggle,
  label,
}: {
  on: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** What is being switched, for screen readers: "Leeds on the home page". */
  label: string;
}) {
  const [pressed, setPressed] = useState<boolean | null>(null);
  const shown = busy && pressed !== null ? pressed : on;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => {
        setPressed(!on);
        onToggle();
      }}
      className="group inline-flex min-h-9 items-center gap-2 rounded-full px-1 text-xs font-semibold text-ink-muted disabled:cursor-progress"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          shown ? "bg-metal" : "bg-sunken ring-1 ring-line"
        }`}
      >
        <span
          className={`absolute h-4 w-4 rounded-full bg-surface shadow transition-transform ${shown ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </span>
      <span className={shown ? "text-ink" : ""}>{shown ? "On" : "Off"}</span>
    </button>
  );
}
