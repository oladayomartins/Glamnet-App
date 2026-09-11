"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationArrow } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { NEXT_STATUS, type BookingStatus } from "@/lib/domain/types";

/**
 * The provider action ladder (§P-05).
 *
 * One primary action at a time, and it is always the single legal next step:
 * the lifecycle is strictly linear, so offering a menu would only offer
 * transitions the server is going to refuse. The label names the step in the
 * provider's words — "On my way" rather than "PROVIDER_EN_ROUTE".
 */
const ACTION_LABELS: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: "Confirm this job",
  CONFIRMED: "Unlock the address",
  ADDRESS_UNLOCKED: "On my way",
  PROVIDER_EN_ROUTE: "Arrived",
  ARRIVED: "Start",
  IN_PROGRESS: "Complete",
};

/** What each step means, so nobody taps one to find out. */
const ACTION_NOTES: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: "Confirms the slot with the customer and holds your calendar.",
  CONFIRMED:
    "Releases the customer's street address to you. Do this when you are about to set off.",
  ADDRESS_UNLOCKED: "Tells the customer you have left and started travelling.",
  PROVIDER_EN_ROUTE: "Marks you as at the door.",
  ARRIVED: "Starts the appointment.",
  IN_PROGRESS:
    "Ends the appointment. Payment is released once the customer rates the work.",
};

export function JobActions({
  bookingId,
  status,
  addressLine,
  addressUnlocked,
}: {
  bookingId: string;
  status: string;
  addressLine: string;
  addressUnlocked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT_STATUS[status as BookingStatus] ?? null;
  const label = ACTION_LABELS[status as BookingStatus];

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, actor: "PROVIDER" }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Could not update this job.");
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this job.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle>Your next step</SectionTitle>

      {/* The address exists on the booking from the moment it is placed, but
          the provider does not see it until the lifecycle says so. */}
      {addressUnlocked && addressLine ? (
        <div className="mb-4 rounded-glam-sm bg-sunken p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Address
          </p>
          <p className="mt-1 text-[15px] text-ink">{addressLine}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
          >
            <NavigationArrow size={16} weight="light" aria-hidden />
            Open in maps
          </a>
        </div>
      ) : (
        <p className="mb-4 rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
          The street address is released when you unlock it, just before you set
          off. Until then you have the sector.
        </p>
      )}

      {label && next ? (
        <>
          <Button onClick={advance} disabled={busy} className="w-full">
            {busy ? "Saving…" : label}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">
            {ACTION_NOTES[status as BookingStatus]}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Nothing to do here. This job is with the customer now.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
