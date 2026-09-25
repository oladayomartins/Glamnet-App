"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { LEGAL } from "@/lib/legal";

/**
 * The customer's [ Cancel booking ].
 *
 * States the cost before anything happens — free, or the exact fee and why —
 * and sends back the fee it showed, so if the clock ticks past the free
 * window while the page is open the server asks again rather than charging
 * something the customer never saw.
 */
export function CancelBooking({
  bookingId,
  feeMinor,
  explanation,
  freeUntilLabel,
}: {
  bookingId: string;
  feeMinor: number;
  explanation: string;
  /** "Fri 9 Oct, 14:00", in UK time; null before a vendor is booked. */
  freeUntilLabel: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, acceptedFeeMinor: feeMinor }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not cancel this booking.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel this booking.");
      // The cost may have changed: show the latest terms.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle hint={freeUntilLabel && feeMinor === 0 ? `Free until ${freeUntilLabel}` : undefined}>
        Need to cancel?
      </SectionTitle>
      <p className="text-sm text-ink">{explanation}</p>
      {feeMinor > 0 ? (
        <p className="mt-1 text-sm font-semibold text-ink">
          Cancelling now costs {formatMoney(feeMinor)}. The rest of the hold on your card is released.
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-sm text-ink-muted">Anything your vendor should know? (optional)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-accent-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={cancel} disabled={busy}>
              {busy ? "Cancelling…" : feeMinor > 0 ? `Cancel and pay ${formatMoney(feeMinor)}` : "Yes, cancel booking"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep my booking
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setConfirming(true)}>
          Cancel booking
        </Button>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-ink-muted">
        <Link href="/cancellations" className="underline underline-offset-2 hover:text-ink">
          Our cancellation policy
        </Link>
      </p>
    </Card>
  );
}

/** Shown in place of the cancel card once it's too late to cancel in the app. */
export function CancelTooLate({ explanation }: { explanation: string }) {
  return (
    <Card className="p-4">
      <SectionTitle>Need to cancel?</SectionTitle>
      <p className="text-sm text-ink-muted">
        {explanation}{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-ink underline underline-offset-2">
          {LEGAL.contactEmail}
        </a>
      </p>
    </Card>
  );
}
