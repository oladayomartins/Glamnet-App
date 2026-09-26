"use client";

import { useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";

/**
 * News and offers emails, on or off. Booking and account emails aren't
 * affected — they're part of the service, not marketing.
 */
export function MarketingEmails({ initiallySubscribed }: { initiallySubscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const toggle = async () => {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/account/marketing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscribed: !subscribed }),
      });
      if (!response.ok) throw new Error();
      setSubscribed(!subscribed);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
      <EnvelopeSimple size={16} weight={subscribed ? "fill" : "regular"} className="text-accent-700" aria-hidden />
      {subscribed ? "News and offers emails are on." : "News and offers emails are off."}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="inline-flex min-h-11 items-center px-1 font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
      >
        {busy ? "Saving…" : subscribed ? "Turn off" : "Turn on"}
      </button>
      {error ? <span role="alert" className="text-warning">That didn&rsquo;t save — try again.</span> : null}
    </p>
  );
}
