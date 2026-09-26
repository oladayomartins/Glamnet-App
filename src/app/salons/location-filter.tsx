"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PostcodeField } from "@/components/postcode-field";
import { Button } from "@/components/ui";
import { DEFAULT_RADIUS_MILES, RADIUS_MILES } from "@/lib/domain/postcode";

/**
 * Where the client is: any UK postcode (or just "S10"), typed, picked from
 * suggestions, or taken from the phone's location, plus how far they will go.
 * Everything lands in the URL, so a search can be shared.
 */
export function LocationFilter({
  basePath,
  hub,
  near,
  radius,
}: {
  basePath: string;
  hub: string | null;
  near: string | null;
  radius: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(near ?? "");
  const [miles, setMiles] = useState(radius);

  const go = (postcode: string | null, withinMiles = miles) => {
    const search = new URLSearchParams();
    if (hub) search.set("hub", hub);
    if (postcode) {
      search.set("near", postcode);
      search.set("radius", String(withinMiles));
    }
    const text = search.toString();
    router.push(`${basePath}${text ? `?${text}` : ""}`);
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go(value.trim() || null);
      }}
      className="grid items-start gap-3 rounded-glam border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      <PostcodeField
        label="Your postcode"
        value={value}
        onChange={setValue}
        allowOutcode
        placeholder="e.g. M1 1AE or SW1A"
        hint="Anywhere in the UK. We sort pros nearest first."
        onResolved={(place) => {
          // Using location lands straight on the results.
          if (place?.postcode && place.postcode !== near && document.activeElement?.tagName !== "INPUT") {
            go(place.postcode);
          }
        }}
      />
      <label className="block">
        <span className="text-sm font-medium text-ink">Within</span>
        <select
          value={miles}
          onChange={(event) => {
            const next = Number(event.target.value);
            setMiles(next);
            if (value.trim()) go(value.trim(), next);
          }}
          className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent-500"
        >
          {RADIUS_MILES.map((option) => (
            <option key={option} value={option}>
              {option} miles
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 sm:pt-6">
        <Button type="submit">Search</Button>
        {near ? (
          <Button type="button" variant="ghost" onClick={() => go(null, DEFAULT_RADIUS_MILES)}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
