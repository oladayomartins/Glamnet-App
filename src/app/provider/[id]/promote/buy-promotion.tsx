"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { formatDay, formatMoney } from "@/lib/format";

interface Package {
  days: number;
  priceMinor: number;
  /** ISO, or null when every slot is taken for the next three months. */
  startsAt: string | null;
  /** A slot is free now, so it runs from the moment it's paid. */
  startsNow: boolean;
}

/**
 * Pick a length and pay. The start date shown is the server's answer: today
 * when a slot is free, otherwise the first day one frees up for the whole run.
 */
export function BuyPromotion({
  productKey,
  packages,
  extending,
  disabled,
}: {
  productKey: string;
  packages: Package[];
  extending: boolean;
  disabled: boolean;
}) {
  const [days, setDays] = useState(packages[0]?.days ?? 7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = packages.find((option) => option.days === days) ?? packages[0];

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/provider/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productKey, days }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message ?? "That didn't go through. Please try again.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't go through. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mt-auto space-y-3">
      <div role="radiogroup" aria-label="Length" className="grid grid-cols-3 gap-2">
        {packages.map((option) => {
          const selected = option.days === days;
          return (
            <button
              key={option.days}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDays(option.days)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-glam-sm px-2 py-2 text-sm transition duration-[180ms] ${
                selected ? "bg-ink text-canvas" : "bg-sunken text-ink ring-1 ring-line hover:ring-accent-500"
              }`}
            >
              <span className="font-semibold">{option.days} days</span>
              <span data-numeric className="text-xs opacity-80">
                {formatMoney(option.priceMinor)}
              </span>
            </button>
          );
        })}
      </div>

      {chosen ? (
        <p className="text-xs text-ink-muted">
          {!chosen.startsAt
            ? "Every slot is booked for the next three months. Try a shorter length."
            : chosen.startsNow
              ? "Starts as soon as you've paid."
              : extending
                ? `Starts ${formatDay(chosen.startsAt)}, straight after your current one.`
                : `All slots are taken until then, so it starts ${formatDay(chosen.startsAt)}.`}
        </p>
      ) : null}

      <Button onClick={buy} disabled={busy || disabled || !chosen?.startsAt} className="w-full">
        {busy ? "Opening checkout…" : chosen ? `${extending ? "Extend" : "Buy"} for ${formatMoney(chosen.priceMinor)}` : "Buy"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-emergency">
          {error}
        </p>
      ) : null}
    </div>
  );
}
