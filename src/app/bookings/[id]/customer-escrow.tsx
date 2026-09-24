"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKey } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";

/**
 * The customer's checkout PIN (Directory Flow 2).
 *
 * Shown only on the customer's own booking page. The page refreshes itself
 * while the PIN is live, so the moment the vendor enters it the screen moves
 * on to "payment released" without the customer touching anything.
 */
export function CheckoutPin({ pin, providerName }: { pin: string; providerName: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <Card className="border-accent-500 p-5 text-center">
      <p className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">
        <LockKey size={14} weight="fill" aria-hidden />
        Your checkout PIN
      </p>
      <p
        data-numeric
        aria-label={`PIN ${pin.split("").join(" ")}`}
        className="mt-3 font-mono text-5xl font-bold tracking-[0.4em] text-ink"
      >
        {pin}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-muted">
        Happy with the result? Read this code to {providerName}. It releases the payment
        held on your card. Not happy? Keep it to yourself and tell us below.
      </p>
    </Card>
  );
}

/**
 * [ File a Service Dispute ]. The server decides whether this renders at all:
 * after the 24-hour window the component is not sent to the page, and the
 * API refuses the request regardless.
 */
export function DisputeForm({
  bookingId,
  closesAt,
}: {
  bookingId: string;
  /** ISO time the window shuts, or null while payment is still held. */
  closesAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/dispute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not file the dispute.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not file the dispute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle
        hint={
          closesAt
            ? `Open until ${new Date(closesAt).toLocaleString("en-GB", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : undefined
        }
      >
        Something wrong?
      </SectionTitle>
      {open ? (
        <form onSubmit={submit} className="space-y-3">
          <textarea
            required
            minLength={10}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell us what happened"
            className="w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-accent-500"
          />
          <Button type="submit" variant="secondary" disabled={busy || reason.trim().length < 10}>
            {busy ? "Sending…" : "File a service dispute"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          File a service dispute
        </Button>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Disputes can be filed for 24 hours after payment is released. After that the booking
        is closed.
      </p>
    </Card>
  );
}
