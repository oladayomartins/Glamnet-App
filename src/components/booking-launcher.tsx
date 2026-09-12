"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
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

type When = { kind: "now" } | { kind: "day"; date: string };

interface CategoryGroup {
  name: string;
  services: ServiceOption[];
}

/** How many days ahead a customer may pick. Matches the offer horizon. */
const HORIZON_DAYS = 7;

/**
 * The hero booking bar (§C-01 block 1).
 *
 * A bar of fixed height, not a stack that grows. Each control opens its panel
 * as an OVERLAY — absolutely positioned, floating over whatever is beneath —
 * so answering a question never changes the height of anything. That matters
 * here more than it usually would: the hero band's height decides how far the
 * photograph behind it has to crop, so a module that grew as it was filled in
 * re-cropped the picture under the customer's hands while they used it.
 *
 * The timing pill sits above the bar, the way the reference puts "Pickup now"
 * above its fields, and defaults to the soonest slot — which is what most
 * people want and means the bar needs only two answers before it can search.
 *
 * It stops short of committing to anything. Submitting hands the answers to
 * /search, which computes real offers from real calendars; this never prices,
 * never reserves, and never decides whether a booking is an emergency. It
 * states the rule and lets the server apply it.
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
  // Defaulted rather than required. "As soon as someone is free" is both the
  // commonest answer and the one the marketplace is built around, so asking
  // for it up front would be asking a question already answered.
  const [when, setWhen] = useState<When>({ kind: "now" });
  const [open, setOpen] = useState<"where" | "what" | "when" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const thresholdHours = Math.round(thresholdMinutes / 60);

  // A panel that floats over the page has to close when attention leaves it,
  // or it sits on top of whatever the customer looks at next.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = () => {
    if (!area || !service) return;
    const params = new URLSearchParams({
      q: service.name,
      location: area.sector,
    });
    if (when.kind === "now") params.set("availableToday", "1");
    if (when.kind === "day") params.set("date", when.date);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* When — the pill above the bar, already answered. */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen(open === "when" ? null : "when")}
          aria-expanded={open === "when"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-card ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-sunken"
        >
          {when.kind === "now" ? (
            <Lightning size={15} weight="light" aria-hidden />
          ) : (
            <CalendarBlank size={15} weight="light" aria-hidden />
          )}
          {when.kind === "now"
            ? "As soon as someone is free"
            : formatDayLabel(when.date)}
          <CaretDown
            size={13}
            weight="bold"
            aria-hidden
            className="text-ink-muted"
          />
        </button>
      </div>

      {/*
        The bar. One row from `sm`, stacked below it, and its height does not
        depend on what has been answered — the dividers move, nothing grows.
      */}
      {/* The bar and its two panels share a positioning context, so a panel
          hangs off the BAR rather than off the fine print beneath it. */}
      <div className="relative mt-3">
        <div className="flex flex-col gap-2 rounded-glam border border-line bg-surface p-2 shadow-card sm:flex-row sm:items-center sm:gap-0">
          <Field
            label="Where"
            value={area ? `${area.sector} · ${area.city}` : null}
            placeholder="Your service location"
            icon={<MapPin size={17} weight="light" aria-hidden />}
            open={open === "where"}
            onToggle={() => setOpen(open === "where" ? null : "where")}
          />

          <div className="hidden h-9 w-px shrink-0 bg-line sm:block" />

          <Field
            label="What"
            value={service ? service.name : null}
            placeholder="Search for a service…"
            icon={<MagnifyingGlass size={17} weight="light" aria-hidden />}
            open={open === "what"}
            onToggle={() => setOpen(open === "what" ? null : "what")}
          />

          <Button
            onClick={go}
            disabled={!area || !service}
            className="shrink-0 sm:ml-2 sm:w-auto"
          >
            Find my glam
          </Button>
        </div>

        <Panel open={open === "where"} className="inset-x-0">
          <AreaPicker
            areas={areas}
            onPick={(picked) => {
              setArea(picked);
              // Where you are can change what is bookable, so an answer taken
              // under the old location is cleared rather than carried over.
              setService(null);
              setOpen("what");
            }}
          />
        </Panel>

        {/*
          All three panels hang off the BAR, including the timing one whose
          control sits above it. A panel dropping from the pill landed on top
          of the bar and covered the two fields the customer had just been
          reading.
        */}
        <Panel
          open={open === "when"}
          fit
          className="left-0 w-[min(23rem,calc(100vw-2rem))]"
        >
          <WhenPicker
            thresholdHours={thresholdHours}
            value={when}
            onPick={(picked) => {
              setWhen(picked);
              setOpen(null);
            }}
          />
        </Panel>

        <Panel open={open === "what"} className="inset-x-0">
          <ServicePicker
            hints={hints}
            onPick={(picked) => {
              setService(picked);
              setOpen(null);
            }}
          />
        </Panel>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        {/*
          The rule, not a verdict. Whether a booking is an emergency is decided
          on the server from the gap between placing it and the appointment,
          and nothing chosen here can change that.
        */}
        Within {thresholdHours} hours of booking counts as an emergency booking.
      </p>
    </div>
  );
}

/**
 * A floating panel.
 *
 * Absolute, so opening one cannot move anything. It is rendered only while
 * open rather than hidden: a panel that is merely invisible still holds its
 * contents in the tab order, and this one is full of buttons.
 */
function Panel({
  open,
  fit,
  className = "",
  children,
}: {
  open: boolean;
  /**
   * A panel holding one fixed thing rather than a list — the calendar. It is
   * given room to show all of itself: a month that scrolls is worse than a
   * month that is tall, because scrolling hides the weeks a customer is
   * trying to compare.
   */
  fit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className={`absolute top-full z-30 mt-2 overflow-y-auto rounded-glam border border-line bg-surface p-3 shadow-raised ${
        fit ? "max-h-[min(34rem,85vh)]" : "max-h-[min(22rem,60vh)]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** One control in the bar: a label, and either the answer or the prompt. */
function Field({
  label,
  value,
  placeholder,
  icon,
  open,
  onToggle,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-glam-sm px-3 text-left transition duration-[180ms] ease-glam hover:bg-sunken ${
        open ? "bg-sunken" : ""
      }`}
    >
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </span>
        <span
          className={`block truncate text-[15px] leading-tight ${
            value ? "font-semibold text-ink" : "text-ink-muted"
          }`}
        >
          {value ?? placeholder}
        </span>
      </span>
    </button>
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
  value: When;
  onPick: (value: When) => void;
}) {
  const today = startOfToday();
  // Offers look HORIZON_DAYS ahead and no further, so that is exactly how far
  // a day can be chosen. A calendar that accepted a date the matcher cannot
  // answer would be collecting an answer in order to throw it away.
  const lastBookable = addDays(today, HORIZON_DAYS - 1);

  const [month, setMonth] = useState(() => startOfMonth(today));

  const canGoBack = month > startOfMonth(today);
  const canGoForward = month < startOfMonth(lastBookable);

  return (
    <div>
      <button
        type="button"
        onClick={() => onPick({ kind: "now" })}
        aria-pressed={value.kind === "now"}
        className={`flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-3 py-2.5 text-left ring-1 transition duration-[180ms] ${
          value.kind === "now"
            ? "bg-brand-50 ring-brand-200"
            : "ring-line hover:bg-sunken"
        }`}
      >
        <Lightning size={18} weight="light" aria-hidden className="shrink-0" />
        <span>
          <span className="block text-[15px] font-semibold text-ink">
            As soon as someone is free
          </span>
          <span className="block text-xs text-ink-muted">
            The earliest a vetted vendor can reach you
          </span>
        </span>
      </button>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <MonthArrow
            direction="back"
            disabled={!canGoBack}
            onClick={() => setMonth(addMonths(month, -1))}
          />
          <p
            aria-live="polite"
            className="text-sm font-semibold text-ink"
          >
            {month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </p>
          <MonthArrow
            direction="forward"
            disabled={!canGoForward}
            onClick={() => setMonth(addMonths(month, 1))}
          />
        </div>

        {/*
          A real grid, Monday first, so the days sit under the weekday they
          fall on — a row of pills could never show that, and "Mon 14" in a
          scrolling strip made the customer read rather than look.
        */}
        <div
          role="grid"
          aria-label="Choose a day"
          className="mt-2 grid grid-cols-7 gap-1"
        >
          {["M", "T", "W", "T", "F", "S", "S"].map((initial, index) => (
            <div
              key={index}
              role="columnheader"
              aria-label={WEEKDAY_NAMES[index]}
              className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted"
            >
              {initial}
            </div>
          ))}

          {monthGrid(month).map((day, index) => {
            // Leading blanks before the first of the month. Keyed by position,
            // which is stable for a given month.
            if (!day) return <div key={`pad-${index}`} aria-hidden />;

            const dayValue = toDayValue(day);
            const bookable = day >= today && day <= lastBookable;
            const selected = value.kind === "day" && value.date === dayValue;
            const isToday = day.getTime() === today.getTime();

            return (
              <button
                key={dayValue}
                type="button"
                role="gridcell"
                disabled={!bookable}
                aria-selected={selected}
                aria-label={`${day.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}${bookable ? "" : " — not bookable"}`}
                onClick={() => onPick({ kind: "day", date: dayValue })}
                className={`flex h-11 items-center justify-center rounded-glam-sm text-sm tabular-nums transition duration-[180ms] ${
                  selected
                    ? "bg-metal font-bold text-metal-ink"
                    : bookable
                      ? "text-ink hover:bg-sunken"
                      : "text-ink-muted/45"
                } ${isToday && !selected ? "font-bold ring-1 ring-brand-200" : ""}`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Times come from vendors&rsquo; real calendars on the next screen, and a
        slot within {thresholdHours} hours of booking is an emergency booking.
        Days are bookable {HORIZON_DAYS} days ahead.
      </p>
    </div>
  );
}

/** One month step. Disabled when there is nothing bookable that way. */
function MonthArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "back" ? CaretLeft : CaretRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "back" ? "Previous month" : "Next month"}
      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition duration-[180ms] enabled:hover:bg-sunken enabled:hover:text-ink disabled:opacity-30"
    >
      <Icon size={16} weight="bold" aria-hidden />
    </button>
  );
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * The cells of a month, Monday first, padded with nulls to the first weekday.
 *
 * Trailing padding is left off deliberately: an empty cell at the end of the
 * last row shows nothing and costs a row of height in a panel that is already
 * floating over the page.
 */
function monthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  // getDay() is Sunday-first; the grid is Monday-first.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
  ];
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
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
