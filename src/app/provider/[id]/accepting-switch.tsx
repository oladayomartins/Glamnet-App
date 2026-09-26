"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The one "Accepting bookings" switch, at the top of the dashboard.
 *
 * There used to be two — a vacation toggle and a "Taking work" card — which
 * wrote the same flag but read as opposites, so a vendor could see one "off"
 * and the other "On" at the same time. This is the only control for it now.
 *
 * Turning it off stops new requests and pauses the storefront calendar; it
 * never releases a booking already accepted. The copy says so, because a
 * vendor switching off before an appointment needs to know their afternoon
 * job is still theirs.
 */
export function AcceptingSwitch({
  providerId,
  initial,
  disabled,
}: {
  providerId: string;
  initial: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !accepting;
    setBusy(true);
    setError(null);
    // Optimistic: the switch is the one control that must feel instant.
    setAccepting(next);
    try {
      const response = await fetch(`/api/providers/${providerId}/availability`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAcceptingWork: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Could not save that.");
      }
      router.refresh();
    } catch (cause) {
      setAccepting(!next);
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-glam border p-4 transition duration-[180ms] ease-glam ${
        accepting ? "border-normal/30 bg-normal-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-full ${accepting ? "breathe bg-normal" : "bg-line"}`}
        />
        <div className="min-w-0 flex-1">
          <p id="accepting-label" className="text-[17px] font-bold text-ink">
            {accepting ? "Accepting bookings" : "Bookings paused"}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {accepting
              ? "New requests reach you by notification."
              : "No new requests. Jobs you've accepted are unaffected."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          aria-labelledby="accepting-label"
          onClick={toggle}
          disabled={busy || disabled}
          className={`relative h-11 w-[4.5rem] shrink-0 rounded-full transition duration-[180ms] ease-glam disabled:opacity-50 ${
            accepting ? "bg-normal" : "bg-sunken ring-1 ring-line"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-card transition-all duration-[180ms] ease-glam ${
              accepting ? "left-[calc(100%-2.5rem)]" : "left-1"
            }`}
          />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
