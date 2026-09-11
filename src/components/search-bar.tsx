"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui";

interface Area {
  id: string;
  name: string;
  city: string;
  sector: string;
}

interface Suggestion {
  id: string;
  label: string;
  hint: string;
  href: string;
}

interface Group {
  key: string;
  label: string;
  items: Suggestion[];
}

/** Long enough that a keystroke is not a query, short enough to feel live. */
const DEBOUNCE_MS = 160;

/**
 * Service + location search, with live suggestions.
 *
 * A combobox rather than a plain field: the marketplace's whole promise is
 * that what you see is bookable, and a suggestion list is the earliest point
 * that promise can be kept — every row comes from the server already filtered
 * to services with a vendor behind them and vendors who are taking work.
 *
 * Submitting still goes to /search, which does the real query. The list is a
 * shortcut, not the only way through, so a customer who ignores it entirely
 * loses nothing.
 */
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
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  // Stored with the term it answers, the same way the booking flow stores
  // slots and quotes. Deriving "is this stale" from that key means nothing has
  // to be cleared synchronously, and a slow reply for an old term can never
  // appear under a newer one.
  const [result, setResult] = useState<{ key: string; groups: Group[] } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const term = query.trim();
  const ready = term.length >= 2;
  const groups = ready && result?.key === term ? result.groups : [];
  const loading = ready && result?.key !== term;

  // One option per line, in render order, so the keyboard can walk the list
  // without caring which group a row belongs to.
  const flat = groups.flatMap((group) => group.items);

  // One option per city, since a customer thinks in towns, not sectors.
  const cities = [...new Set(areas.map((area) => area.city))].sort();

  useEffect(() => {
    if (!ready) return;

    const controller = new AbortController();

    // Debounced, so holding a key down does not become a query per character.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/search/suggestions?q=${encodeURIComponent(term)}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("no suggestions");
          const payload = await response.json();
          setResult({ key: term, groups: payload.groups ?? [] });
          setActiveIndex(-1);
        } catch {
          if (controller.signal.aborted) return;
          // A failed lookup is not an error the customer needs to see: the
          // field still works and submitting still searches.
          setResult({ key: term, groups: [] });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, ready]);

  // A click anywhere else closes the list. Pointerdown rather than click, so
  // it closes on the way down and does not fight a link being followed.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setOpen(false);

    // Enter on a highlighted row goes where that row points; otherwise it is
    // an ordinary search for whatever has been typed.
    const chosen = flat[activeIndex];
    if (chosen) {
      router.push(chosen.href);
      return;
    }

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("location", location.trim());
    router.push(`/search?${params.toString()}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (flat.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        // Wraps at both ends, so the list is a loop rather than a dead stop.
        if (next < 0) return flat.length - 1;
        if (next >= flat.length) return 0;
        return next;
      });
    }
  };

  const showList = open && (loading || flat.length > 0);

  return (
    <div ref={rootRef} className="relative">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-glam border border-line bg-surface p-2 shadow-card sm:flex-row sm:items-center"
      >
        <label className="flex flex-1 items-center gap-2 px-2">
          <MagnifyingGlass
            size={18}
            weight="light"
            className="shrink-0 text-ink-muted"
            aria-hidden
          />
          <span className="sr-only">What do you need?</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Braids, makeup, blow dry…"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
            }
            className="min-h-11 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          />
          {loading ? (
            <SpinnerGap
              size={16}
              className="shrink-0 animate-spin text-ink-muted"
              aria-hidden
            />
          ) : null}
        </label>

        <label className="flex items-center gap-2 border-line px-2 sm:border-l">
          <span className="sr-only">Where?</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="min-h-11 w-full bg-transparent text-[15px] text-ink outline-none sm:w-40"
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

      {showList ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-glam border border-line bg-surface shadow-raised"
        >
          {flat.length === 0 && loading ? (
            <p className="px-4 py-3 text-sm text-ink-muted">Looking…</p>
          ) : null}

          {groups.map((group) => (
            <div key={group.key} className="border-b border-line last:border-0">
              <p className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {group.label}
              </p>
              <ul>
                {group.items.map((item) => {
                  const index = flat.indexOf(item);
                  return (
                    <li key={`${group.key}-${item.id}`}>
                      <button
                        type="button"
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          setOpen(false);
                          router.push(item.href);
                        }}
                        className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[15px] transition duration-[180ms] ${
                          index === activeIndex
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink hover:bg-sunken"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {item.hint}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
