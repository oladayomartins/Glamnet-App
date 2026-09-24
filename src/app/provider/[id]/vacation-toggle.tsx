"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AirplaneTilt } from "@phosphor-icons/react";

/**
 * Vacation mode: one switch that takes the vendor off the directory, closes
 * their storefront calendar and stops broadcasts, without touching their
 * weekly hours. Existing bookings are kept. For a specific date range, block
 * it on the availability page instead.
 */
export function VacationToggle({ accepting, disabled }: { accepting: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/provider/accepting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepting: !accepting }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not change that.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-glam border border-line bg-surface p-3">
      <AirplaneTilt size={20} className="text-ink-muted" aria-hidden />
      <span className="flex-1 text-sm text-ink">
        {accepting ? "Taking new bookings" : "On vacation — your storefront is paused"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!accepting}
        aria-label="Vacation mode"
        onClick={toggle}
        disabled={busy || disabled}
        className={`relative h-7 w-12 rounded-full transition ${accepting ? "bg-sunken ring-1 ring-line" : "bg-accent-500"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-ink transition-all ${accepting ? "left-1" : "left-6"}`}
        />
      </button>
      {error ? <p role="alert" className="basis-full text-xs text-warning">{error}</p> : null}
    </div>
  );
}
