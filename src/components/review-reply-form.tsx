"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * The vendor's public reply under a review. Shows the reply once posted,
 * with Edit; an emptied reply is removed.
 */
export function ReviewReplyForm({ bookingId, initialReply }: { bookingId: string; initialReply: string }) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply);
  const [draft, setDraft] = useState(initialReply);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/review/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reply: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Your reply didn't save.");
      setReply(payload.review.reviewReply);
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your reply didn't save.");
    } finally {
      setBusy(false);
    }
  };

  if (reply && !editing) {
    return (
      <div className="mt-3 rounded-glam-sm border-l-2 border-accent-500 bg-sunken p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Your reply</p>
        <p className="mt-1 whitespace-pre-line text-sm text-ink">{reply}</p>
        <button
          type="button"
          onClick={() => {
            setDraft(reply);
            setEditing(true);
          }}
          className="tap-44 mt-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          Edit reply
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tap-44 mt-2 text-sm font-semibold text-brand-700 hover:underline"
      >
        Reply publicly
      </button>
    );
  }

  return (
    <div className="mt-3">
      <label className="block">
        <span className="text-sm font-medium text-ink">Your public reply</span>
        <textarea
          value={draft}
          maxLength={1_000}
          rows={3}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Thank them, or answer a concern. Everyone visiting your storefront can read this."
          className="mt-1 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none transition duration-[180ms] focus:border-accent-500"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || (!draft.trim() && !reply)}>
          {busy ? "Saving…" : draft.trim() ? "Post reply" : "Remove reply"}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
