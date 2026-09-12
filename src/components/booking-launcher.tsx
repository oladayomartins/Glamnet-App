"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarBlank,
  CaretRight,
  Lightning,
  MagnifyingGlass,
  MapPin,
  SpinnerGap,
  SquaresFour,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { formatDuration, formatMoney } from "@/lib/format";
import { useTypedPlaceholder } from "@/components/use-typed-placeholder";

export interface ServiceArea {
  hubId: string;
  /** Postcode sector, e.g. "S11" — the unit coverage is actually sold in. */
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

/** How many days ahead a customer may pick. Matches the offer horizon. */
const HORIZON_DAYS = 7;

/**
 * The hero booking module (§C-01 block 1).
 *
 * Three questions in the order a customer can actually answer them — where,
 * what, when — each opening only once the one before it has an answer. The
 * old bar asked for a service and a town at once and left the customer to
 * work out that one constrained the other.
 *
 * It deliberately stops at the point of committing to anything. Submitting
 * hands the three answers to /search, which computes real offers from real
 * calendars; this module never prices, never reserves, and never decides
 * whether a booking is an emergency. It says what the rule is and lets the
 * server apply it.
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
  const [area, setArea] = useState<ServiceArea | null>(null);
  const [service, setService] = useState<ServiceOption | null>(null);
  const [when, setWhen] = useState<{ kind: "now" } | { kind: "day"; date: string } | null>(
    null,
  );
  // Nothing is open on arrival. The three rows read as a summary of what will
  // be asked, which is a calmer first impression than a panel already
  // demanding an answer — and on a phone an open panel pushed everything
  // below it off the screen before the page had said anything.
  const [step, setStep] = useState<"where" | "what" | "when" | null>(null);

  const thresholdHours = Math.round(thresholdMinutes / 60);

  const go = () => {
    if (!area || !service) return;
    const params = new URLSearchParams({
      q: service.name,
      location: area.sector,
    });
    if (when?.kind === "now") params.set("availableToday", "1");
    if (when?.kind === "day") params.set("date", when.date);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="overflow-hidden rounded-glam border border-line bg-surface shadow-card">
      <Step
        index={1}
        label="Where should we come?"
        value={area ? `${area.sector} · ${area.city}` : null}
        placeholder="Enter your service location"
        icon={<MapPin size={18} weight="light" aria-hidden />}
        open={step === "where"}
        onToggle={() => setStep(step === "where" ? null : "where")}
      >
        <AreaPicker
          areas={areas}
          onPick={(picked) => {
            setArea(picked);
            // Changing where you are can change what is bookable, so the
            // answer below it is cleared rather than silently carried over.
            setService(null);
            setStep("what");
          }}
        />
      </Step>

      <Step
        index={2}
        label="What would you like done?"
        value={service ? service.name : null}
        placeholder="Search for a service…"
        icon={<MagnifyingGlass size={18} weight="light" aria-hidden />}
        open={step === "what"}
        disabled={!area}
        disabledNote="Tell us where first — it decides who can reach you."
        onToggle={() => setStep(step === "what" ? null : "what")}
      >
        <ServicePicker
          hints={hints}
          onPick={(picked) => {
            setService(picked);
            setStep("when");
          }}
        />
      </Step>

      <Step
        index={3}
        label="When do you need it?"
        value={
          when
            ? when.kind === "now"
              ? "As soon as someone is free"
              : formatDayLabel(when.date)
            : null
        }
        placeholder="Now, or pick a date"
        icon={<CalendarBlank size={18} weight="light" aria-hidden />}
        open={step === "when"}
        disabled={!service}
        disabledNote="Choose a service first."
        last
        onToggle={() => setStep(step === "when" ? null : "when")}
      >
        <WhenPicker
          thresholdHours={thresholdHours}
          value={when}
          onPick={(picked) => {
            setWhen(picked);
            setStep(null);
          }}
        />
      </Step>

      <div className="border-t border-line p-3">
        <Button
          onClick={go}
          disabled={!area || !service || !when}
          className="w-full"
        >
          Find my glam
        </Button>
        <p className="mt-2 text-center text-xs text-ink-muted">
          {/*
            The rule, not a verdict. Whether a booking is an emergency is
            decided on the server from the gap between placing it and the
            appointment, and nothing typed here can change that — so this says
            what will be applied rather than claiming to have applied it.
          */}
          Appointments starting within {thresholdHours} hours of booking are
          emergency bookings and are priced accordingly.
        </p>
      </div>
    </div>
  );
}

/** One question in the stack: a row that opens to reveal its own control. */
function Step({
  index,
  label,
  value,
  placeholder,
  icon,
  open,
  disabled,
  disabledNote,
  last,
  onToggle,
  children,
}: {
  index: number;
  label: string;
  value: string | null;
  placeholder: string;
  icon: React.ReactNode;
  open: boolean;
  disabled?: boolean;
  disabledNote?: string;
  last?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = useId();

  return (
    <div className={last ? "" : "border-b border-line"}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition duration-[180ms] ease-glam enabled:hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="shrink-0 text-ink-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            {index}. {label}
          </span>
          <span
            className={`block truncate text-[15px] ${
              value ? "font-semibold text-ink" : "text-ink-muted"
            }`}
          >
            {value ?? placeholder}
          </span>
        </span>
        <CaretRight
          size={16}
          weight="light"
          aria-hidden
          className={`shrink-0 text-ink-muted transition-transform duration-[180ms] ease-glam ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {disabled && disabledNote ? (
        <p className="px-4 pb-3 text-xs text-ink-muted">{disabledNote}</p>
      ) : null}

      {open && !disabled ? (
        <div id={panelId} className="border-t border-line bg-sunken p-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Where the vendor is coming to.
 *
 * The list is the areas GLAMNET actually covers, not an address book. Until
 * there is a geocoder behind this, the honest unit is the postcode sector the
 * marketplace is sold in — offering a free address field would accept a
 * street nobody can be matched to and fail at the point of booking instead of
 * here. The exact door is taken later, on the confirm screen, where it is
 * held back from the vendor until the job is under way.
 */
function AreaPicker({
  areas,
  onPick,
}: {
  areas: ServiceArea[];
  onPick: (area: ServiceArea) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

  const shown = needle
    ? areas.filter((area) =>
        [area.sector, area.city, area.name].some((field) =>
          field.toLowerCase().includes(needle),
        ),
      )
    : areas;

  return (
    <div>
      <label className="flex items-center gap-2 rounded-glam-sm border border-line bg-surface px-3">
        <MagnifyingGlass
          size={16}
          weight="light"
          className="shrink-0 text-ink-muted"
          aria-hidden
        />
        <span className="sr-only">Search areas</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Town or postcode sector"
          autoComplete="off"
          className="min-h-11 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
        />
      </label>

      {shown.length === 0 ? (
        <p className="px-1 pt-3 text-sm text-ink-muted">
          Nobody covers that yet. GLAMNET is in{" "}
          {[...new Set(areas.map((area) => area.city))].join(", ")} so far.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {shown.map((area) => (
            <li key={area.hubId}>
              <button
                type="button"
                onClick={() => onPick(area)}
                className="flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 text-left transition duration-[180ms] hover:bg-surface"
              >
                <MapPin
                  size={16}
                  weight="light"
                  className="shrink-0 text-ink-muted"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-ink">
                    {area.name}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {area.sector} · {area.city}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * What the customer wants, in their words — resolved to the catalogue.
 *
 * The field accepts anything. What comes back is always a real service with
 * an id, a price and a duration, because the booking that follows is made
 * against that id and nothing else. "What did you mean?" is the honest
 * heading for it: the platform is interpreting, and saying so.
 *
 * "Browse services" is not a fallback for a broken search. Plenty of people
 * cannot name what they want and should not have to guess at a word to get
 * anywhere, so the whole catalogue is one tap away at every point.
 */
function ServicePicker({
  hints,
  onPick,
}: {
  hints: string[];
  onPick: (service: ServiceOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [data, setData] = useState<{
    key: string;
    matches: ServiceOption[];
    categories: CategoryGroup[];
  } | null>(null);
  const loadedRef = useRef(false);

  const term = query.trim();
  const ready = term.length >= 2;
  // Keyed to the term it answers, so a slow reply for an old query can never
  // paint itself over a newer one.
  const matches = ready && data?.key === term ? data.matches : [];
  const loading = ready && data?.key !== term;
  const categories = data?.categories ?? [];

  // Stops on a whole phrase the moment the field is in use, and never starts
  // at all under prefers-reduced-motion.
  const placeholder = useTypedPlaceholder(hints, !focused && query === "");

  useEffect(() => {
    const key = ready ? term : "";
    if (!ready && loadedRef.current) return;

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const response = await fetch(
              `/api/services/match?q=${encodeURIComponent(key)}`,
              { signal: controller.signal },
            );
            if (!response.ok) return;
            const payload = await response.json();
            loadedRef.current = true;
            setData({
              key,
              matches: payload.matches ?? [],
              categories: payload.categories ?? [],
            });
          } catch {
            // An abandoned keystroke is not an error worth showing.
          }
        })();
      },
      ready ? 160 : 0,
    );

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ready, term]);

  return (
    <div>
      <label className="flex items-center gap-2 rounded-glam-sm border border-line bg-surface px-3">
        <MagnifyingGlass
          size={16}
          weight="light"
          className="shrink-0 text-ink-muted"
          aria-hidden
        />
        <span className="sr-only">What would you like done?</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setBrowsing(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete="off"
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

      {ready && !browsing ? (
        matches.length > 0 ? (
          <>
            <p className="px-1 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              What did you mean?
            </p>
            <ul className="space-y-1">
              {matches.map((match) => (
                <li key={match.id}>
                  <ServiceRow service={match} onPick={onPick} />
                </li>
              ))}
            </ul>
          </>
        ) : loading ? null : (
          <p className="px-1 pt-3 text-sm text-ink-muted">
            Nothing in the catalogue matches that. Browse below and pick the
            closest — you can say the rest in the notes when you book.
          </p>
        )
      ) : null}

      <button
        type="button"
        onClick={() => setBrowsing(!browsing)}
        aria-expanded={browsing}
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
      >
        <SquaresFour size={16} weight="light" aria-hidden />
        {browsing ? "Hide services" : "Not sure what you need? Browse services"}
      </button>

      {browsing ? (
        <ul className="mt-2 space-y-1">
          {categories.map((category) => (
            <li key={category.name}>
              <button
                type="button"
                onClick={() =>
                  setOpenCategory(
                    openCategory === category.name ? null : category.name,
                  )
                }
                aria-expanded={openCategory === category.name}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-glam-sm px-3 text-left transition duration-[180ms] hover:bg-surface"
              >
                <span className="text-[15px] font-semibold text-ink">
                  {category.name}
                </span>
                <span className="text-xs text-ink-muted">
                  {category.services.length}
                </span>
              </button>

              {openCategory === category.name ? (
                <ul className="space-y-1 pl-3">
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
      ) : null}
    </div>
  );
}

/** One catalogue row: what it is, what it costs, how long it takes. */
function ServiceRow({
  service,
  onPick,
}: {
  service: ServiceOption;
  onPick: (service: ServiceOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(service)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-glam-sm px-3 py-2 text-left transition duration-[180ms] hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] text-ink">
          {service.name}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {service.description || service.category}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span data-numeric className="block text-sm font-semibold text-ink">
          from {formatMoney(service.priceMinor)}
        </span>
        <span className="block text-xs text-ink-muted">
          {formatDuration(service.durationMinutes)}
        </span>
      </span>
    </button>
  );
}

/**
 * Now, or a day.
 *
 * "Now" is not labelled EMERGENCY here even though it usually produces one.
 * The classification belongs to the server and depends on what is actually
 * free — a vendor whose first slot is the day after tomorrow makes "now" a
 * normal booking — so the button promises the earliest someone can come and
 * the note states the rule that will be applied.
 */
function WhenPicker({
  thresholdHours,
  value,
  onPick,
}: {
  thresholdHours: number;
  value: { kind: "now" } | { kind: "day"; date: string } | null;
  onPick: (value: { kind: "now" } | { kind: "day"; date: string }) => void;
}) {
  const days = Array.from({ length: HORIZON_DAYS }, (_, offset) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return toDayValue(date);
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => onPick({ kind: "now" })}
        aria-pressed={value?.kind === "now"}
        className={`flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 py-2.5 text-left ring-1 transition duration-[180ms] ${
          value?.kind === "now"
            ? "bg-surface ring-brand-200"
            : "ring-line hover:bg-surface"
        }`}
      >
        <Lightning size={18} weight="light" aria-hidden className="shrink-0" />
        <span>
          <span className="block text-[15px] font-semibold text-ink">
            As soon as someone is free
          </span>
          <span className="block text-xs text-ink-muted">
            The earliest a vetted vendor can reach you today
          </span>
        </span>
      </button>

      <p className="px-1 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        Or pick a day
      </p>
      <div className="rail flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onPick({ kind: "day", date: day })}
            aria-pressed={value?.kind === "day" && value.date === day}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition duration-[180ms] ${
              value?.kind === "day" && value.date === day
                ? "bg-metal text-metal-ink"
                : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {formatDayLabel(day)}
          </button>
        ))}
      </div>

      <p className="px-1 pt-3 text-xs text-ink-muted">
        Times come from vendors&rsquo; real calendars on the next screen. A slot
        within {thresholdHours} hours of booking is an emergency booking.
      </p>
    </div>
  );
}

/** Local YYYY-MM-DD. `toISOString` would shift the day in any western zone. */
function toDayValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}
