"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

/** Whether every word typed appears somewhere in the given fields. */
export function matches(query: string, ...fields: Array<string | null | undefined>): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * A filter box for a list that is already on the page: narrows as you type,
 * with no round trip.
 */
export function ListFilter({
  value,
  onChange,
  placeholder,
  count,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** How many rows match, shown while filtering. */
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative block w-full sm:w-72">
        <span className="sr-only">{placeholder}</span>
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-10 w-full rounded-glam-sm border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent-500"
        />
      </label>
      {value.trim() && count !== undefined ? (
        <span className="text-xs text-ink-muted" role="status">
          {count} match{count === 1 ? "" : "es"}
        </span>
      ) : null}
    </div>
  );
}
