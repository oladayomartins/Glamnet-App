"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { whenOptions } from "@/lib/domain/when-options";
import { VENDOR_AMENITIES } from "@/lib/domain/vendor-tags";

export interface SearchFilterValues {
  q: string;
  location: string;
  /** The `date` parameter: "" for any day, else YYYY-MM-DD. */
  when: string;
  maxPrice: string;
  minRating: string;
  availableToday: boolean;
  /** Amenity tags the vendor must have all of. */
  tags: string[];
  /**
   * The `at` parameter, if the customer arrived with one. Not editable here —
   * it is carried so that changing a filter does not throw away the exact time
   * they picked somewhere else.
   */
  at: string;
}

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "4000", label: "Up to £40" },
  { value: "8000", label: "Up to £80" },
  { value: "15000", label: "Up to £150" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4.0+" },
  { value: "4.5", label: "4.5+" },
];

/**
 * The sticky filter bar (§C-02).
 *
 * On a wide screen the controls sit in the bar itself. Below 640px the bar
 * collapses to a single Filters button carrying a count of what is applied,
 * and the controls move into a bottom sheet — a filter row that wraps to four
 * lines on a phone is worse than no filter row at all.
 *
 * Every change is written to the URL, so a filtered result set is a link
 * someone can send, and the server does the filtering.
 */
export function SearchFilters({
  cities,
  initial,
}: {
  cities: string[];
  initial: SearchFilterValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The URL is the source of truth: a back navigation, or a link carrying
  // different parameters, has to win over whatever is sitting in the inputs.
  // Adjusting during render rather than in an effect means the inputs never
  // paint one frame of stale values first.
  const signature = JSON.stringify(initial);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setValues(initial);
  }

  const activeCount = [
    initial.location,
    initial.when,
    initial.maxPrice,
    initial.minRating,
    initial.availableToday ? "1" : "",
    ...initial.tags,
  ].filter(Boolean).length;

  // Built once per render from the current clock, in UK time — see
  // when-options.ts for why not the browser's.
  const days = whenOptions(new Date());

  const apply = (next: SearchFilterValues) => {
    setValues(next);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.location) params.set("location", next.location);
    if (next.when) params.set("date", next.when);
    // Carried, not edited. Rebuilding the query from scratch used to drop the
    // customer's chosen time the moment they touched any other filter.
    if (next.at) params.set("at", next.at);
    if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    if (next.minRating) params.set("minRating", next.minRating);
    if (next.availableToday) params.set("availableToday", "1");
    if (next.tags.length > 0) params.set("tags", next.tags.join(","));
    router.push(`/search?${params.toString()}`);
  };

  const controls = (
    <>
      <label className="flex-1">
        <span className="sr-only">Service</span>
        <input
          value={values.q}
          onChange={(event) => setValues({ ...values, q: event.target.value })}
          onBlur={() => apply(values)}
          placeholder="Braids, makeup, blow dry…"
          className="min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none transition duration-[180ms] focus:border-brand-400"
        />
      </label>

      <Select
        label="When"
        value={values.when}
        onChange={(when) =>
          // Choosing a day supersedes an exact time from a previous search,
          // and "Available today" as well: three ways of saying when, two of
          // them now stale, would filter each other down to nothing.
          apply({ ...values, when, at: "", availableToday: false })
        }
        options={days}
      />

      <Select
        label="Where"
        value={values.location}
        onChange={(location) => apply({ ...values, location })}
        options={[
          { value: "", label: "Anywhere" },
          ...cities.map((city) => ({ value: city, label: city })),
        ]}
      />

      <Select
        label="Price"
        value={values.maxPrice}
        onChange={(maxPrice) => apply({ ...values, maxPrice })}
        options={PRICE_OPTIONS}
      />

      <Select
        label="Rating"
        value={values.minRating}
        onChange={(minRating) => apply({ ...values, minRating })}
        options={RATING_OPTIONS}
      />

      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={values.availableToday}
          onChange={(event) =>
            apply({ ...values, availableToday: event.target.checked })
          }
          className="size-4 accent-[var(--glam-rose-700)]"
        />
        Available today
      </label>

      {/* Amenity tags. Toggles rather than a select: they combine, and a
          customer reads "female-only, parking" faster as two lit chips than
          as a multi-select they have to open. */}
      {VENDOR_AMENITIES.map(({ value, label }) => {
        const on = values.tags.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              apply({
                ...values,
                tags: on
                  ? values.tags.filter((tag) => tag !== value)
                  : [...values.tags, value],
              })
            }
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition duration-[180ms] ease-glam ${
              on
                ? "border-accent-500 bg-accent-100/40 text-ink"
                : "border-line bg-surface text-ink-muted hover:border-accent-500/60"
            }`}
          >
            {label}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="sticky top-[61px] z-10 -mx-4 border-b border-line bg-canvas/92 px-4 py-3 backdrop-blur">
      {/* Wide: the controls are the bar. */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">{controls}</div>

      {/* Narrow: one button, with what is applied counted on it. */}
      <div className="flex items-center gap-2 sm:hidden">
        <label className="flex-1">
          <span className="sr-only">Service</span>
          <input
            value={values.q}
            onChange={(event) => setValues({ ...values, q: event.target.value })}
            onBlur={() => apply(values)}
            placeholder="Braids, makeup, blow dry…"
            className="min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand-400"
          />
        </label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line active:scale-[0.98]"
        >
          <FunnelSimple size={16} weight="light" aria-hidden />
          Filters
          {activeCount > 0 ? (
            <span
              data-numeric
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-[11px] font-bold text-on-brand"
            >
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            role="dialog"
            aria-label="Filters"
            className="safe-bottom absolute inset-x-0 bottom-0 space-y-3 rounded-t-glam-lg border-t border-line bg-surface p-4 shadow-raised"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-ink">
                Filters
              </p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="tap-44 text-ink-muted"
              >
                <X size={20} weight="light" />
              </button>
            </div>
            <div className="flex flex-col gap-3">{controls}</div>
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none transition duration-[180ms] focus:border-brand-400 sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
