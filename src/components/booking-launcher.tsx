"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CaretRight,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  SpinnerGap,
  SquaresFour,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { formatDuration, formatMoney } from "@/lib/format";
import { useTypedPlaceholder } from "@/components/use-typed-placeholder";

export interface ServiceArea {
  hubId: string;
  /** Outward code, e.g. "S11" — searched by distance from its centre. */
  sector: string;
  city: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
  durationMinutes: number;
  reason?: "name" | "phrase" | "category";
}

interface CategoryGroup {
  name: string;
  services: ServiceOption[];
}

interface LocationSuggestion {
  kind: "postcode" | "place";
  label: string;
  detail: string;
  lookup: string;
}

/** A place the customer picked, and the area it resolved to. */
interface ChosenArea extends ServiceArea {
  /** What the field shows: "Dartford", "DA1 1AA". */
  label: string;
}

/**
 * The hero search bar (§C-01 block 1).
 *
 * Two fields you type straight into — where, and what — with suggestions
 * dropping beneath each as you go. "Where" takes a town ("Dartford") or any
 * UK postcode, full or partial, and resolves it to the Beauty Hub for that
 * outward code. "What" takes the customer's own words and suggests real
 * catalogue services; free text is fine too, and goes to /search as typed.
 *
 * The suggestion lists float over the page rather than pushing it down, so
 * the hero photograph behind the bar never re-crops while someone types.
 *
 * Timing is not asked here. /search sorts soonest-first across the whole
 * booking horizon, which is what most people want, and filters by day there.
 */
export function BookingLauncher({
  areas,
  hints = [],
  thresholdMinutes,
}: {
  areas: ServiceArea[];
  /** Real, bookable service names for the service field to cycle through. */
  hints?: string[];
  /** The emergency threshold, read from live config so the copy cannot drift. */
  thresholdMinutes: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const whatRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<"where" | "what" | null>(null);

  const [whereText, setWhereText] = useState("");
  const [area, setArea] = useState<ChosenArea | null>(null);
  const [resolving, setResolving] = useState(false);
  const [whereError, setWhereError] = useState<string | null>(null);

  const [whatText, setWhatText] = useState("");
  const [service, setService] = useState<ServiceOption | null>(null);
  const [whatFocused, setWhatFocused] = useState(false);

  const thresholdHours = Math.round(thresholdMinutes / 60);
  const typedHint = useTypedPlaceholder(hints, !whatFocused && whatText === "");

  const places = useSuggestions<LocationSuggestion[]>(
    area ? "" : whereText,
    (q) => `/api/geo/suggest?q=${encodeURIComponent(q)}`,
    (payload) => payload.suggestions ?? [],
  );
  const services = useSuggestions<{ matches: ServiceOption[]; categories: CategoryGroup[] }>(
    service ? "" : whatText,
    (q) => `/api/services/match?q=${encodeURIComponent(q)}`,
    (payload) => ({ matches: payload.matches ?? [], categories: payload.categories ?? [] }),
    true,
  );

  // A list floating over the page has to close when attention leaves it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** A postcode, outward code or town's outward code → its Beauty Hub. */
  const resolveArea = async (lookup: string, label: string): Promise<ChosenArea | null> => {
    setResolving(true);
    setWhereError(null);
    try {
      const response = await fetch(`/api/geo/lookup?q=${encodeURIComponent(lookup)}&hub=1`);
      const payload = await response.json();
      if (!response.ok || !payload.hub) throw new Error(payload.error?.message);
      const chosen = {
        hubId: payload.hub.id,
        sector: payload.hub.sector,
        city: payload.hub.city,
        name: payload.hub.name,
        label,
      };
      setArea(chosen);
      setWhereText(label);
      return chosen;
    } catch {
      setWhereError("We couldn't find that place. Try a town or a postcode.");
      return null;
    } finally {
      setResolving(false);
    }
  };

  const pickPlace = async (lookup: string, label: string) => {
    setOpen(null);
    if (await resolveArea(lookup, label)) {
      // Straight on to "What" where there's room. On a phone its list would
      // cover the search button and the keyboard would jump up, so it waits.
      if (!service && !whatText && window.matchMedia("(min-width: 640px)").matches) {
        whatRef.current?.focus();
        setOpen("what");
      }
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setWhereError("This browser can't share your location. Type a town or postcode.");
      return;
    }
    setResolving(true);
    setOpen(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(`/api/geo/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error?.message);
          await pickPlace(payload.place.postcode ?? payload.place.outcode, payload.place.postcode ?? payload.place.outcode);
        } catch (cause) {
          setResolving(false);
          setWhereError(cause instanceof Error && cause.message ? cause.message : "We couldn't find where you are. Type it instead.");
        }
      },
      () => {
        setResolving(false);
        setWhereError("Location is switched off. Type a town or postcode instead.");
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const pickService = (picked: ServiceOption) => {
    setService(picked);
    setWhatText(picked.name);
    setOpen(null);
  };

  const go = async () => {
    // A place typed but not picked from the list: take the best suggestion,
    // or look up what was typed directly.
    let chosen = area;
    const typedPlace = whereText.trim();
    if (!chosen && typedPlace) {
      const first = places.loading ? undefined : places.data?.[0];
      chosen = first ? await resolveArea(first.lookup, first.label) : await resolveArea(typedPlace, typedPlace.toUpperCase());
      if (!chosen) return;
    }
    const params = new URLSearchParams();
    const q = service?.name ?? whatText.trim();
    if (q) params.set("q", q);
    if (chosen) params.set("location", chosen.sector);
    setOpen(null);
    router.push(`/search${params.size ? `?${params.toString()}` : ""}`);
  };

  const canSearch = Boolean(whereText.trim() || whatText.trim());
  const coveredCities = [...new Map(areas.map((entry) => [entry.city, entry])).values()].slice(0, 6);

  const placeRows = whereText.trim().length >= 2 && !area ? (places.data ?? []) : [];
  const serviceRows = whatText.trim().length >= 2 && !service ? (services.data?.matches ?? []) : [];

  return (
    <div ref={rootRef} className="relative">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void go();
        }}
        className="flex flex-col gap-2 rounded-glam border border-line bg-surface p-2 shadow-card sm:flex-row sm:items-center sm:gap-0"
      >
        {/* Where */}
        <div className="relative min-w-0 flex-1">
          <InputField
            label="Where"
            icon={<MapPin size={17} weight="light" aria-hidden />}
            value={whereText}
            placeholder="Town or postcode"
            active={open === "where"}
            busy={resolving || (places.loading && !area)}
            autoComplete="off"
            onFocus={() => setOpen("where")}
            onChange={(value) => {
              setWhereText(value);
              setArea(null);
              setWhereError(null);
              setOpen("where");
            }}
            listKeys={placeRows.length}
            onPickIndex={(index) => {
              const row = placeRows[index];
              if (row) void pickPlace(row.lookup, row.label);
            }}
          />
          {open === "where" ? (
            <Dropdown className="sm:right-auto sm:w-[max(100%,22rem)]">
              {placeRows.length > 0 ? (
                <ul role="listbox" aria-label="Places">
                  {placeRows.map((row, index) => (
                    <li key={`${row.kind}-${row.label}-${row.detail}`}>
                      <button
                        type="button"
                        data-option={index}
                        onClick={() => void pickPlace(row.lookup, row.label)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 py-1.5 text-left transition hover:bg-sunken focus:bg-sunken focus:outline-none"
                      >
                        <MapPin size={16} weight="light" className="shrink-0 text-ink-muted" aria-hidden />
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-[15px] font-medium text-ink ${
                              row.kind === "postcode" ? "[word-spacing:0.25em]" : ""
                            }`}
                          >
                            <Highlight text={row.label} query={whereText} />
                          </span>
                          <span className="block truncate text-xs text-ink-muted">{row.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : whereText.trim().length >= 2 && !area && !places.loading ? (
                <p className="px-3 py-2 text-sm text-ink-muted">
                  No town or postcode starts with that. Check the spelling, or try your postcode.
                </p>
              ) : null}

              {whereText.trim().length < 2 ? (
                <>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    className="flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 text-left text-[15px] font-semibold text-accent-700 transition hover:bg-sunken"
                  >
                    <NavigationArrow size={16} weight="fill" aria-hidden />
                    Use my current location
                  </button>
                  {coveredCities.length > 0 ? (
                    <>
                      <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                        Areas with pros on GLAMNET
                      </p>
                      <ul className="grid grid-cols-2 gap-0.5">
                        {coveredCities.map((entry) => (
                          <li key={entry.hubId}>
                            <button
                              type="button"
                              onClick={() => void pickPlace(entry.sector, entry.city)}
                              className="flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 text-left transition hover:bg-sunken"
                            >
                              <MapPin size={15} weight="light" className="shrink-0 text-ink-muted" aria-hidden />
                              <span className="min-w-0 truncate text-[15px] text-ink">
                                {entry.city} <span className="text-xs text-ink-muted">{entry.sector}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}
            </Dropdown>
          ) : null}
        </div>

        <div className="hidden h-9 w-px shrink-0 bg-line sm:block" />

        {/* What */}
        <div className="relative min-w-0 flex-1">
          <InputField
            inputRef={whatRef}
            label="What"
            icon={<MagnifyingGlass size={17} weight="light" aria-hidden />}
            value={whatText}
            placeholder={typedHint || "Braids, nails, massage…"}
            active={open === "what"}
            busy={services.loading && !service}
            autoComplete="off"
            onFocus={() => {
              setWhatFocused(true);
              setOpen("what");
            }}
            onBlur={() => setWhatFocused(false)}
            onChange={(value) => {
              setWhatText(value);
              setService(null);
              setOpen("what");
            }}
            listKeys={serviceRows.length}
          />
          {open === "what" ? (
            <Dropdown className="sm:left-auto sm:right-0 sm:w-[max(100%,24rem)]">
              <ServiceSuggestions
                query={whatText}
                picked={Boolean(service)}
                matches={serviceRows}
                loading={services.loading}
                categories={services.data?.categories ?? []}
                onPick={pickService}
              />
            </Dropdown>
          ) : null}
        </div>

        <Button type="submit" disabled={!canSearch || resolving} className="shrink-0 sm:ml-2 sm:w-auto">
          Find my glam
        </Button>
      </form>

      {whereError ? (
        <p role="alert" className="mt-2 text-xs text-warning">
          {whereError}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">
          {/* The rule, not a verdict: the server decides from the real gap. */}
          Anywhere in the UK. Within {thresholdHours} hours of booking counts as an emergency booking.
        </p>
      )}
    </div>
  );
}

/**
 * Debounced suggestions for a typed term, keyed to the term they answer so a
 * slow reply for an old query can never paint over a newer one. With
 * `loadEmpty`, the empty term is fetched once too (for browse lists).
 */
function useSuggestions<T>(
  text: string,
  url: (q: string) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON from our own API
  pick: (payload: any) => T,
  loadEmpty = false,
): { data: T | null; loading: boolean } {
  const term = text.trim();
  const ready = term.length >= 2;
  const [state, setState] = useState<{ key: string; data: T } | null>(null);
  const [empty, setEmpty] = useState<T | null>(null);
  const pickRef = useRef(pick);
  const urlRef = useRef(url);
  useEffect(() => {
    pickRef.current = pick;
    urlRef.current = url;
  });

  useEffect(() => {
    if (!ready && (!loadEmpty || empty !== null)) return;
    const key = ready ? term : "";
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const response = await fetch(urlRef.current(key), { signal: controller.signal });
            if (!response.ok) return;
            const data = pickRef.current(await response.json());
            if (key) setState({ key, data });
            else setEmpty(data);
          } catch {
            // An abandoned keystroke is not an error worth showing.
          }
        })();
      },
      ready ? 180 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ready, term, loadEmpty, empty]);

  if (!ready) return { data: empty, loading: false };
  return { data: state?.key === term ? state.data : (state?.data ?? empty), loading: state?.key !== term };
}

/** A labelled input living in the bar, with arrow-key and Enter support for its list. */
function InputField({
  label,
  icon,
  value,
  placeholder,
  active,
  busy,
  autoComplete,
  inputRef,
  onFocus,
  onBlur,
  onChange,
  listKeys,
  onPickIndex,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  active: boolean;
  busy: boolean;
  autoComplete: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onFocus: () => void;
  onBlur?: () => void;
  onChange: (value: string) => void;
  /** How many suggestions are showing, for ArrowDown to move into. */
  listKeys: number;
  /** Enter on a half-typed word takes this row; without it, Enter submits. */
  onPickIndex?: (index: number) => void;
}) {
  return (
    <label
      className={`focus-shell flex min-h-12 cursor-text items-center gap-2.5 rounded-glam-sm px-3 transition duration-[180ms] ease-glam hover:bg-sunken ${
        active ? "bg-sunken" : ""
      }`}
    >
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          enterKeyHint="search"
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // ArrowDown moves into the list; the options are buttons, so Tab
            // and Enter work on them natively from there.
            if (event.key === "ArrowDown" && listKeys > 0) {
              event.preventDefault();
              const list = event.currentTarget.closest(".relative")?.querySelector<HTMLButtonElement>("[data-option='0']");
              list?.focus();
            }
            if (onPickIndex && event.key === "Enter" && listKeys > 0 && event.currentTarget.value.trim().length >= 2) {
              // "dartf" + Enter means Dartford: take the top suggestion.
              event.preventDefault();
              onPickIndex(0);
            }
          }}
          className="block w-full truncate bg-transparent text-[15px] font-semibold leading-tight text-ink [word-spacing:0.2em] outline-none placeholder:font-normal placeholder:text-ink-muted placeholder:[word-spacing:normal]"
        />
      </span>
      {busy ? <SpinnerGap size={16} className="shrink-0 animate-spin text-ink-muted" aria-hidden /> : null}
    </label>
  );
}

/**
 * A floating list under a field. Absolute, so opening one moves nothing; and
 * ArrowUp/ArrowDown walk its options.
 */
function Dropdown({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const at = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = options[at + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }}
      className={`absolute inset-x-0 top-full z-30 mt-2 max-h-[min(24rem,60vh)] overflow-y-auto rounded-glam border border-line bg-surface p-2 shadow-raised ${className}`}
    >
      {children}
    </div>
  );
}

/** Bold the part of a suggestion that matches what was typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-accent-700">{text.slice(at, at + q.length)}</span>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * What the customer wants, in their words — matched to the catalogue. Free
 * text is allowed (it searches as typed), and the whole catalogue is one tap
 * away for anyone who can't name what they want.
 */
function ServiceSuggestions({
  query,
  picked,
  matches,
  loading,
  categories,
  onPick,
}: {
  query: string;
  picked: boolean;
  matches: ServiceOption[];
  loading: boolean;
  categories: CategoryGroup[];
  onPick: (service: ServiceOption) => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const typing = query.trim().length >= 2 && !picked;

  return (
    <div>
      {typing ? (
        matches.length > 0 ? (
          <ul role="listbox" aria-label="Services">
            {matches.map((match, index) => (
              <li key={match.id}>
                <ServiceRow service={match} index={index} query={query} onPick={onPick} />
              </li>
            ))}
          </ul>
        ) : loading ? null : (
          <p className="px-3 py-2 text-sm text-ink-muted">
            Nothing matches that exactly — press <span className="font-semibold text-ink">Find my glam</span> to search
            anyway, or browse below.
          </p>
        )
      ) : null}

      {categories.length > 0 ? (
        <>
          <p className="flex items-center gap-2 px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            <SquaresFour size={12} aria-hidden /> {typing ? "Or browse" : "Browse services"}
          </p>
          <ul>
            {categories.map((category) => (
              <li key={category.name}>
                <button
                  type="button"
                  onClick={() => setOpenCategory(openCategory === category.name ? null : category.name)}
                  aria-expanded={openCategory === category.name}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-glam-sm px-3 text-left transition hover:bg-sunken focus:bg-sunken focus:outline-none"
                >
                  <span className="text-[15px] font-medium text-ink">{category.name}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    {category.services.length}
                    <CaretRight
                      size={12}
                      aria-hidden
                      className={`transition-transform ${openCategory === category.name ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>
                {openCategory === category.name ? (
                  <ul className="pl-3">
                    {category.services.map((option) => (
                      <li key={option.id}>
                        <ServiceRow service={option} onPick={onPick} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** One catalogue row: what it is, what it costs, how long it takes. */
function ServiceRow({
  service,
  index,
  query = "",
  onPick,
}: {
  service: ServiceOption;
  index?: number;
  query?: string;
  onPick: (service: ServiceOption) => void;
}) {
  return (
    <button
      type="button"
      data-option={index}
      onClick={() => onPick(service)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-glam-sm px-3 py-2 text-left transition hover:bg-sunken focus:bg-sunken focus:outline-none"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] text-ink">
          <Highlight text={service.name} query={query} />
        </span>
        <span className="block truncate text-xs text-ink-muted">{service.description || service.category}</span>
      </span>
      <span className="shrink-0 text-right">
        <span data-numeric className="block text-sm font-semibold text-ink">
          from {formatMoney(service.priceMinor)}
        </span>
        <span className="block text-xs text-ink-muted">{formatDuration(service.durationMinutes)}</span>
      </span>
    </button>
  );
}
