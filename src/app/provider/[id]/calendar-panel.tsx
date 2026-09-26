"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { Card, SectionTitle } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";
import { ProviderCalendar, type CalendarPayload } from "./calendar";
import { requestVendorRefresh, useVendorRefresh } from "./vendor-events";

/** The calendar with its date and Day/Week controls. */
export function CalendarPanel({
  providerId,
  heading = "Your calendar",
}: {
  providerId: string;
  heading?: string;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  useVendorRefresh(() => setReloadToken((token) => token + 1));

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          `/api/providers/${providerId}/calendar?view=${view}&date=${date}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Could not load the calendar.");
        }
        setCalendar(payload);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load the calendar.");
      }
    })();

    return () => controller.abort();
  }, [providerId, view, date, reloadToken]);

  return (
    <section id="calendar" className="scroll-mt-20">
      <SectionTitle hint="Reserved time includes a 15-minute transition period">
        {heading}
      </SectionTitle>

      <Card className="p-4">
        <div className="mb-4 flex items-end gap-2">
          <label className="block min-w-0 flex-1 sm:flex-none">
            <span className="text-xs font-medium text-ink-muted">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-400"
            />
          </label>

          <div
            className="inline-flex shrink-0 overflow-hidden rounded-glam-sm border border-line"
            role="group"
            aria-label="Calendar view"
          >
            {(["day", "week"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={`min-h-11 px-4 text-sm font-semibold capitalize transition duration-[180ms] ease-glam ${
                  view === option
                    ? "bg-brand-50 text-brand-700"
                    : "bg-surface text-ink-muted hover:bg-sunken"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={requestVendorRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-glam-sm border border-line bg-surface text-ink transition duration-[180ms] hover:bg-sunken"
          >
            <ArrowClockwise size={18} aria-hidden />
          </button>
        </div>

        {error ? (
          <p role="alert" className="mb-3 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
            {error}
          </p>
        ) : null}

        {calendar ? (
          <ProviderCalendar
            calendar={calendar}
            availabilityHref={`/provider/${providerId}/availability`}
          />
        ) : (
          <p className="text-sm text-ink-muted">Loading calendar…</p>
        )}
      </Card>
    </section>
  );
}
