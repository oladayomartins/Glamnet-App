"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function UnsubscribeButton({
  token,
  email,
  initiallyOptedOut,
}: {
  token: string;
  email: string;
  initiallyOptedOut: boolean;
}) {
  const [optedOut, setOptedOut] = useState(initiallyOptedOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (unsubscribe: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/unsubscribe?t=${encodeURIComponent(token)}${unsubscribe ? "" : "&resubscribe=1"}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error();
      setOptedOut(unsubscribe);
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-ink">
        {optedOut ? "You're unsubscribed" : "Unsubscribe from GLAMNET news?"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {optedOut
          ? `We won't send news or offers to ${email} again. You'll still get emails about your own bookings and account.`
          : `Stop news and offers emails to ${email}. Emails about your own bookings and account will still arrive.`}
      </p>
      <div className="mt-5">
        {optedOut ? (
          <Button variant="ghost" onClick={() => change(false)} disabled={busy}>
            {busy ? "Saving…" : "Changed your mind? Resubscribe"}
          </Button>
        ) : (
          <Button onClick={() => change(true)} disabled={busy}>
            {busy ? "Saving…" : "Unsubscribe"}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
