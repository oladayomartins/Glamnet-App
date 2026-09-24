"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle, Crosshair, MapPin } from "@phosphor-icons/react";
import { formatPostcode } from "@/lib/domain/postcode";

export interface ResolvedPlace {
  postcode: string | null;
  outcode: string;
  city: string;
  lat: number;
  lng: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; place: ResolvedPlace }
  | { kind: "error"; message: string };

/**
 * A UK postcode box: suggestions as you type, a check against the real
 * postcode list, and "Use my location".
 *
 * Any UK postcode works, from Aberdeen to Truro and Belfast. The confirmed
 * place (outward code, town and coordinates) is handed to `onResolved`;
 * callers decide whether an outward code alone ("S10") is enough.
 */
export function PostcodeField({
  label = "Postcode",
  value,
  onChange,
  onResolved,
  placeholder = "e.g. S10 2HN",
  allowOutcode = false,
  allowLocate = true,
  hint,
  className = "",
  inputClassName = "",
  autoFocus,
  inlineSuggestions = false,
}: {
  /** Render suggestions in the flow, for use inside a clipped panel. */
  inlineSuggestions?: boolean;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onResolved: (place: ResolvedPlace | null) => void;
  placeholder?: string;
  /** Accept "S10" on its own (for searching), not only a full postcode. */
  allowOutcode?: boolean;
  allowLocate?: boolean;
  hint?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  // Suggestions remember the text they were fetched for, so stale ones never
  // show against newer typing.
  const [fetched, setFetched] = useState<{ query: string; postcodes: string[] }>({ query: "", postcodes: [] });
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const lookupFor = useRef("");
  const resolvedRef = useRef(onResolved);
  useEffect(() => {
    resolvedRef.current = onResolved;
  }, [onResolved]);

  const trimmed = value.trim();
  const suggestions = fetched.query === trimmed && !formatPostcode(trimmed) ? fetched.postcodes : [];

  const lookup = async (raw: string) => {
    const query = raw.trim();
    const full = formatPostcode(query);
    if (!full && !(allowOutcode && /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(query.replace(/\s/g, "")))) {
      setStatus(query ? { kind: "error", message: "Enter a full UK postcode, like S10 2HN." } : { kind: "idle" });
      resolvedRef.current(null);
      return;
    }
    lookupFor.current = query;
    setStatus({ kind: "checking" });
    try {
      const response = await fetch(`/api/geo/lookup?q=${encodeURIComponent(full ?? query)}`);
      const payload = await response.json();
      if (lookupFor.current !== query) return;
      if (!response.ok) throw new Error(payload.error?.message ?? "We couldn't find that postcode.");
      setStatus({ kind: "ok", place: payload.place });
      if (full && full !== raw) onChange(full);
      resolvedRef.current(payload.place);
    } catch (cause) {
      if (lookupFor.current !== query) return;
      setStatus({ kind: "error", message: cause instanceof Error ? cause.message : "We couldn't find that postcode." });
      resolvedRef.current(null);
    }
  };

  // Suggestions while typing, until the postcode is complete.
  useEffect(() => {
    const query = value.trim();
    if (query.replace(/\s/g, "").length < 2 || formatPostcode(query)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geo/autocomplete?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json();
        setFetched({ query, postcodes: payload.postcodes ?? [] });
        setActive(-1);
      } catch {
        // Suggestions are a convenience; typing still works without them.
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // A complete postcode is checked as soon as it is typed.
  useEffect(() => {
    if (formatPostcode(value) && lookupFor.current !== value.trim()) void lookup(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup is stable in behaviour
  }, [value]);

  const pick = (postcode: string) => {
    onChange(postcode);
    setOpen(false);
    void lookup(postcode);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus({ kind: "error", message: "This browser can't share your location. Type your postcode instead." });
      return;
    }
    setStatus({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(`/api/geo/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error?.message);
          const place: ResolvedPlace = payload.place;
          lookupFor.current = place.postcode ?? "";
          onChange(place.postcode ?? place.outcode);
          setStatus({ kind: "ok", place });
          resolvedRef.current(place);
        } catch (cause) {
          setStatus({
            kind: "error",
            message: cause instanceof Error && cause.message ? cause.message : "We couldn't find your postcode. Type it instead.",
          });
        }
      },
      () => setStatus({ kind: "error", message: "Location is switched off. Type your postcode instead." }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const listId = `${id}-list`;
  const showList = open && suggestions.length > 0;

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <div className="relative flex-1">
          <MapPin size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={id}
            value={value}
            autoFocus={autoFocus}
            autoComplete="postal-code"
            spellCheck={false}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onChange={(event) => {
              onChange(event.target.value.toUpperCase());
              setOpen(true);
              if (status.kind !== "checking") setStatus({ kind: "idle" });
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Let a click on a suggestion land first.
              setTimeout(() => setOpen(false), 150);
              if (value.trim() && lookupFor.current !== value.trim()) void lookup(value);
            }}
            onKeyDown={(event) => {
              if (!showList) {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void lookup(value);
                }
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => Math.min(current + 1, suggestions.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (active >= 0) pick(suggestions[active]);
                else void lookup(value);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className={`min-h-11 w-full rounded-glam-input border border-line bg-surface py-2 pl-9 pr-9 font-mono text-[15px] uppercase tracking-wider text-ink outline-none transition focus:border-accent-500 ${inputClassName}`}
          />
          {status.kind === "checking" ? (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-accent-500" aria-hidden />
          ) : status.kind === "ok" ? (
            <CheckCircle size={18} weight="fill" className="pop-in absolute right-3 top-1/2 -translate-y-1/2 text-normal" aria-label="Postcode found" />
          ) : null}
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              className={`${inlineSuggestions ? "relative" : "absolute inset-x-0 top-full z-30"} mt-1 max-h-64 overflow-auto rounded-glam border border-line bg-surface py-1 shadow-raised`}
            >
              {suggestions.map((postcode, index) => (
                <li
                  key={postcode}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(postcode);
                  }}
                  className={`cursor-pointer px-3 py-2 font-mono text-sm tracking-wider ${index === active ? "bg-sunken text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink"}`}
                >
                  {postcode}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {allowLocate ? (
          <button
            type="button"
            onClick={locate}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-ink-muted transition hover:border-accent-500 hover:text-ink"
            title="Use my location"
          >
            <Crosshair size={16} aria-hidden />
            <span className="hidden sm:inline">Use my location</span>
          </button>
        ) : null}
      </div>
      <p
        role="status"
        className={`mt-1.5 min-h-4 text-xs ${status.kind === "error" ? "text-warning" : status.kind === "ok" ? "text-normal-ink" : "text-ink-muted"}`}
      >
        {status.kind === "ok"
          ? `${status.place.city} · ${status.place.outcode}`
          : status.kind === "error"
            ? status.message
            : (hint ?? "")}
      </p>
    </div>
  );
}
