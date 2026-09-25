"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardHold } from "@/components/card-hold";
import { Button, Card } from "@/components/ui";

/**
 * Put a card (back) on a booking: after a hold was declined or lapsed, or to
 * finish a checkout the customer left half-way. The booking goes ahead as
 * soon as Stripe has the card.
 */
export function UpdateCard({
  bookingId,
  amountMinor,
  reason,
  unfinished,
}: {
  bookingId: string;
  amountMinor: number;
  /** Why the last attempt failed, in the bank's words. */
  reason: string;
  /** A checkout that was never finished, rather than a card that failed. */
  unfinished: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<{ clientSecret: string; mode: "payment" | "setup" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/payment`, { method: "PUT" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not start the card step.");
      if (payload.payment?.kind === "card") {
        setStep({ clientSecret: payload.payment.clientSecret, mode: payload.payment.mode });
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the card step.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 border-warning/60 p-4">
      <div>
        <p className="font-display font-semibold text-ink">
          {unfinished ? "Finish adding your card" : "Your card needs attention"}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {unfinished
            ? "This booking isn't secured yet. Add your card and it goes ahead straight away."
            : `We couldn't hold the payment for this appointment${reason ? ` (${reason.replace(/[.\s]+$/, "")})` : ""}. Add a card to keep your booking — otherwise it will be cancelled the day before. Nothing has been charged.`}
        </p>
      </div>
      {step ? (
        <CardHold
          bookingId={bookingId}
          clientSecret={step.clientSecret}
          amountMinor={amountMinor}
          mode={step.mode}
          onAuthorised={() => {
            setStep(null);
            router.refresh();
          }}
        />
      ) : (
        <Button onClick={start} disabled={busy} className="w-full">
          {busy ? "Just a moment…" : unfinished ? "Add my card" : "Update my card"}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
