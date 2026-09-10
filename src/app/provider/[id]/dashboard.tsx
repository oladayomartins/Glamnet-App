"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { BroadcastTicket, type BroadcastRequest } from "./broadcast-ticket";
import { ProviderCalendar, type CalendarPayload } from "./calendar";
import { toDateInputValue } from "@/lib/format";

/**
 * Ties the calendar and the request inbox together: accepting a request
 * reserves calendar time, so both panes refresh from the server on every
 * acceptance rather than trying to patch local state.
 */
export function ProviderDashboard({ providerId }: { providerId: string }) {
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [requests, setRequests] = useState<BroadcastRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Bumped after an acceptance to pull fresh data; the fetch itself lives in
  // the effect below so nothing sets state synchronously during render.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const [calendarResponse, requestsResponse] = await Promise.all([
          fetch(
            `/api/providers/${providerId}/calendar?view=${view}&date=${date}`,
            { cache: "no-store", signal: controller.signal },
          ),
          fetch(`/api/providers/${providerId}/requests`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const calendarPayload = await calendarResponse.json();
        const requestsPayload = await requestsResponse.json();

        if (!calendarResponse.ok) {
          throw new Error(
            calendarPayload.error?.message ?? "Could not load the calendar.",
          );
        }

        setCalendar(calendarPayload);
        setRequests(requestsResponse.ok ? requestsPayload.requests : []);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "Could not load the dashboard.",
        );
      }
    })();

    return () => controller.abort();
  }, [providerId, view, date, reloadToken]);

  const refresh = () => setReloadToken((token) => token + 1);

  const accept = async (bookingId: string) => {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not accept this booking.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not accept this booking.",
      );
    } finally {
      setBusyId(null);
      // Reload either way: on success the calendar has a new reservation, and
      // on a lost race the request should disappear from the inbox.
      refresh();
    }
  };

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-emergency bg-emergency-soft p-3 text-sm text-emergency-ink"
        >
          {error}
        </p>
      ) : null}

      <section>
        <SectionTitle
          hint={
            requests.length === 0
              ? "No open requests"
              : `${requests.length} awaiting your response`
          }
        >
          Booking requests
        </SectionTitle>

        {requests.length === 0 ? (
          <EmptyState>
            No open requests right now. New broadcasts appear here the moment a
            customer books in your sector.
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {requests.map((request) => (
              <BroadcastTicket
                key={request.bookingId}
                request={request}
                busy={busyId === request.bookingId}
                onAccept={() => accept(request.bookingId)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle hint="Reserved time includes a 15-minute transition period">
          Your calendar
        </SectionTitle>

        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 block min-h-11 rounded-glam-sm border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <div
              className="inline-flex overflow-hidden rounded-glam-sm border border-line"
              role="group"
              aria-label="Calendar view"
            >
              {(["day", "week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`px-3 py-1.5 text-sm font-medium capitalize transition ${
                    view === option
                      ? "bg-brand-700 text-on-brand"
                      : "bg-surface text-ink-muted hover:bg-sunken"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <Button variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </div>

          {calendar ? (
            <ProviderCalendar calendar={calendar} />
          ) : (
            <p className="text-sm text-ink-muted">Loading calendar…</p>
          )}
        </Card>
      </section>
    </div>
  );
}
