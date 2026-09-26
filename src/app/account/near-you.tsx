"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PostcodeField, type ResolvedPlace } from "@/components/postcode-field";
import { Button } from "@/components/ui";

/**
 * "Find pros near you", remembering the postcode on the customer's profile so
 * the next visit starts from it.
 */
export function NearYou({ savedPostcode }: { savedPostcode: string }) {
  const router = useRouter();
  const [postcode, setPostcode] = useState(savedPostcode);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    const query = (place?.postcode ?? place?.outcode ?? postcode).trim();
    if (!query) return;
    setBusy(true);
    if (query !== savedPostcode) {
      // Remembered for next time; a failed save never blocks the search.
      await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcode: query }),
      }).catch(() => undefined);
    }
    router.push(`/salons?near=${encodeURIComponent(query)}`);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void search();
      }}
      className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <PostcodeField
        label="Your postcode"
        value={postcode}
        onChange={setPostcode}
        onResolved={setPlace}
        allowOutcode
        placeholder="e.g. M1 1AE"
        hint={savedPostcode ? "We remember this so pros near you show up first." : "Anywhere in the UK."}
      />
      <Button type="submit" disabled={busy || !postcode.trim()} className="sm:mt-6">
        <MagnifyingGlass size={16} weight="bold" aria-hidden />
        {busy ? "Searching…" : "Find pros"}
      </Button>
    </form>
  );
}
