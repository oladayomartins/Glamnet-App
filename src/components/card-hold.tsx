"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";

/** Loaded once per page, and only when a publishable key exists. */
let stripePromise: Promise<Stripe | null> | null = null;
function stripe(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

/**
 * The pre-authorisation card hold (Directory Flow 1, step 5).
 *
 * Stripe Elements collects the card in Stripe's own iframe, so card numbers
 * never touch GLAMNET's servers. Confirming here only *authorises* the
 * amount; nothing is captured until the customer's PIN is entered at the end
 * of the appointment. The booking is then confirmed server-side, where the
 * hold is checked with Stripe rather than taken on this page's word.
 */
export function CardHold({
  bookingId,
  clientSecret,
  amountMinor,
  onAuthorised,
}: {
  bookingId: string;
  clientSecret: string;
  amountMinor: number;
  onAuthorised: () => void;
}) {
  const promise = useMemo(() => stripe(), []);

  if (!promise) {
    return (
      <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
        Card payments are not configured on this deployment
        (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing).
      </p>
    );
  }

  return (
    <Elements stripe={promise} options={{ clientSecret, appearance: { theme: "night" } }}>
      <HoldForm bookingId={bookingId} amountMinor={amountMinor} onAuthorised={onAuthorised} />
    </Elements>
  );
}

function HoldForm({
  bookingId,
  amountMinor,
  onAuthorised,
}: {
  bookingId: string;
  amountMinor: number;
  onAuthorised: () => void;
}) {
  const stripeClient = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripeClient || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const { error: confirmError } = await stripeClient.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/bookings/${bookingId}` },
        // Cards authorise in place; only a bank redirect leaves the page.
        redirect: "if_required",
      });
      if (confirmError) throw new Error(confirmError.message ?? "Your card was not authorised.");

      const response = await fetch(`/api/bookings/${bookingId}/payment`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not confirm the hold.");
      onAuthorised();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your card was not authorised.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      <Button type="submit" disabled={busy || !stripeClient} className="w-full">
        {busy ? "Authorising…" : `Hold ${formatMoney(amountMinor)} on my card`}
      </Button>
      {error ? (
        <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}
