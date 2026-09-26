"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "@phosphor-icons/react";

/**
 * Save a vendor to come back to.
 *
 * Bridal, locs and anything booked weeks ahead is rarely booked on a first
 * visit, so a customer needs somewhere to put a vendor they liked rather than
 * relying on finding them again.
 *
 * Optimistic: the heart fills on tap and reverts if the request fails. The
 * endpoint is idempotent, so a double-tap or a retry cannot leave the button
 * and the database disagreeing.
 *
 * A signed-out visitor is sent to sign in and returned here rather than being
 * shown a button that silently does nothing — and rather than the button being
 * hidden, which would make the feature invisible to exactly the people who
 * have not signed up yet.
 */
export function SaveVendor({
  providerId,
  initialSaved,
  canSave,
  signInHref,
}: {
  providerId: string;
  initialSaved: boolean;
  /** False for signed-out visitors and for vendors viewing a storefront. */
  canSave: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!canSave) {
      router.push(signInHref);
      return;
    }

    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      const response = await fetch(`/api/saved/${providerId}`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!response.ok) throw new Error("Could not save.");
    } catch {
      // Put the heart back where it was. Leaving it filled would tell the
      // customer they have a saved vendor they do not have.
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={canSave ? saved : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition duration-[180ms] ease-glam ${
        saved
          ? "border-accent-500 bg-accent-100/40 text-ink"
          : "border-line bg-surface text-ink hover:border-accent-500"
      }`}
    >
      <Heart size={16} weight={saved ? "fill" : "regular"} aria-hidden />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
