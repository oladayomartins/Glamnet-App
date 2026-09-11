"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui";

interface Area {
  id: string;
  name: string;
  city: string;
  sector: string;
}

/** Service + location search. Submits to /search, which does the real work. */
export function SearchBar({
  areas,
  initialQuery = "",
  initialLocation = "",
}: {
  areas: Area[];
  initialQuery?: string;
  initialLocation?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);

  // One option per city, since a customer thinks in towns, not sectors.
  const cities = [...new Set(areas.map((area) => area.city))].sort();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("location", location.trim());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-glam border border-line bg-surface p-2 shadow-card sm:flex-row"
    >
      <label className="flex flex-1 items-center gap-2 px-2">
        <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-ink-muted" />
        <span className="sr-only">What do you need?</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Braids, makeup, blow dry…"
          className="min-h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </label>

      <label className="flex items-center gap-2 border-line px-2 sm:border-l">
        <span className="sr-only">Where?</span>
        <select
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="min-h-11 w-full bg-transparent text-sm text-ink outline-none sm:w-40"
        >
          <option value="">Anywhere</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" className="sm:w-auto">
        Search
      </Button>
    </form>
  );
}
