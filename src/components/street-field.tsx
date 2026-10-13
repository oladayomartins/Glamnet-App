"use client";

import { useEffect, useId, useState } from "react";
import { applySuggestion, searchText, type AddressSuggestion } from "@/lib/domain/address";
import type { LatLng } from "@/lib/domain/postcode";

/**
 * The house number and street box, with suggestions from the streets and
 * houses around the postcode already entered (`near`). Suggestions are free
 * OpenStreetMap data, so they are a shortcut, not a gate: anything typed is
 * still accepted, and with no postcode yet it is a plain text box.
 */
export function StreetField({
  label,
  value,
  onChange,
  near,
  placeholder,
  hint,
  maxLength,
  autoComplete = "address-line1",
  labelClassName = "block text-sm font-medium text-ink",
  inputClassName = "mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent-500",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  near: LatLng | null;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  autoComplete?: string;
  labelClassName?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  // Suggestions remember what they were fetched for, so stale ones never
  // show against newer typing or a different postcode.
  const [fetched, setFetched] = useState<{ key: string; suggestions: AddressSuggestion[] }>({ key: "", suggestions: [] });
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [needsNumber, setNeedsNumber] = useState(false);

  const query = searchText(value);
  const key = near ? `${near.lat.toFixed(5)},${near.lng.toFixed(5)}|${query.toLowerCase()}` : "";
  // Each option reads as what the box will hold once it is picked, so a
  // street after "14 " shows as "14 Dover Road" (and repeats collapse).
  const options = (key && fetched.key === key ? fetched.suggestions : [])
    .map((suggestion) => ({ suggestion, text: applySuggestion(value, suggestion) }))
    .filter((option, index, all) => all.findIndex((other) => other.text === option.text) === index);
  const showList = open && options.length > 0 && !options.some((option) => option.text === value.trim());

  useEffect(() => {
    if (!open || !near || fetched.key === key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, lat: String(near.lat), lng: String(near.lng) });
        const response = await fetch(`/api/geo/addresses?${params}`, { signal: controller.signal });
        const payload = await response.json();
        setFetched({ key, suggestions: payload.suggestions ?? [] });
        setActive(-1);
      } catch {
        // Suggestions are a convenience; typing still works without them.
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, near, key, query, fetched.key]);

  const pick = ({ suggestion, text }: (typeof options)[number]) => {
    onChange(text);
    setNeedsNumber(suggestion.kind === "street" && !/\d/.test(text));
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setNeedsNumber(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Let a click on a suggestion land first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((current) => Math.min(current + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            pick(options[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClassName}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-glam border border-line bg-surface py-1 shadow-raised"
        >
          {options.map((option, index) => (
            <li
              key={option.text}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${index === active ? "bg-sunken text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink"}`}
            >
              {option.text}
            </li>
          ))}
        </ul>
      ) : null}
      {needsNumber ? (
        <p role="status" className="mt-1 text-xs text-ink-muted">
          Now add your house or flat number in front of the street.
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
