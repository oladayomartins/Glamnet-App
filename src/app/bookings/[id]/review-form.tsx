"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { track } from "@/lib/analytics";

const STARS = [1, 2, 3, 4, 5];

/**
 * Rating and review (§C-10).
 *
 * Each star is its own 44px target — a five-star strip squeezed into one row
 * of 20px glyphs is the classic way to receive a three when someone meant a
 * four. The copy states plainly that rating releases the payment, because a
 * customer who does not know that has no reason to come back and do it.
 */
export function ReviewForm({
  bookingId,
  providerName,
}: {
  bookingId: string;
  providerName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hovered || rating;

  const submit = async () => {
    if (rating === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, note }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Could not save your rating.");
      }
      track("review_submitted", { rating, has_note: note.trim().length > 0 });
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save your rating.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle>How did it go?</SectionTitle>

      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label={`Rate ${providerName} out of five`}
        onMouseLeave={() => setHovered(0)}
      >
        {STARS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHovered(value)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition duration-[180ms] ease-glam active:scale-[0.98] hover:bg-sunken"
          >
            <Star
              size={26}
              weight={value <= shown ? "fill" : "light"}
              className={value <= shown ? "text-accent-500" : "text-ink-muted"}
              aria-hidden
            />
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-ink">
          Anything to add <span className="text-ink-muted">(optional)</span>
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder={`What was ${providerName} like to have in your home?`}
          className="mt-1 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
        />
      </label>

      <Button
        onClick={submit}
        disabled={busy || rating === 0}
        className="mt-4 w-full"
      >
        {busy ? "Saving…" : "Submit rating"}
      </Button>

      <p className="mt-2 text-center text-xs text-ink-muted">
        Your payment is released to {providerName} once you have rated the work.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
