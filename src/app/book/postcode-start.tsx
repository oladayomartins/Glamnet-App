"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PostcodeField, type ResolvedPlace } from "@/components/postcode-field";

/** Step 1: any UK postcode → that area's booking page. */
export function PostcodeStart() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (place: ResolvedPlace | null) => {
    if (!place || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/geo/lookup?q=${encodeURIComponent(place.postcode ?? place.outcode)}&hub=1`);
      const payload = await response.json();
      if (!response.ok || !payload.hub) throw new Error(payload.error?.message);
      router.push(`/book/${payload.hub.id}`);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "We couldn't look that postcode up just now.");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <PostcodeField
        label="Your postcode"
        value={postcode}
        onChange={setPostcode}
        onResolved={(place) => void go(place)}
        allowOutcode
        autoFocus
        hint={busy ? "Finding pros near you…" : "Anywhere in the UK. We show pros within 10 miles."}
      />
      {error ? <p className="mt-1 text-sm text-warning">{error}</p> : null}
    </div>
  );
}
