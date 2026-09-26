"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowClockwise, Broadcast } from "@phosphor-icons/react";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { BroadcastTicket, type BroadcastRequest } from "./broadcast-ticket";
import { ProviderCalendar, type CalendarPayload } from "./calendar";
import { toDateInputValue } from "@/lib/format";
import { track } from "@/lib/analytics";

/**
 * Ties the calendar and the request inbox together: accepting a request
 * reserves calendar time, so both panes refresh from the server on every
 * acceptance rather than trying to patch local state.
 *
 * The page reads top to bottom in order of urgency: requests first, then
 * today's numbers (`today`), the calendar, and whatever the page passes as
 * `children` (the bio link and settings).
 */
export function ProviderDashboard({
  providerId,
  today,
  children,
}: {
  providerId: string;
  today: ReactNode;
  children?: ReactNode;
}) {
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
        // Emergency tickets come first. They have the least notice and the
        // shortest acceptance window, so burying one under three normal
        // requests costs the vendor the job.
        setRequests(
          requestsResponse.ok
            ? [...(requestsPayload.requests as BroadcastRequest[])].sort(
                (a, b) =>
                  Number(b.bookingType === "EMERGENCY") -
                    Number(a.bookingType === "EMERGENCY") ||
                  Date.parse(a.acceptanceExpiresAt) -
                    Date.parse(b.acceptanceExpiresAt),
              )
            : [],
        );
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

  // A vendor comes back to this page by tapping a request notification, often
  // after it has sat in a background tab for hours. Reload on return so the
  // request they were told about is actually on screen.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setReloadToken((token) => token + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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
      track("vendor_accept_booking", { outcome: response.ok ? "accepted" : "failed" });
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
          className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}

      <section id="requests" className="scroll-mt-20">
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
          <EmptyState
            icon={<Broadcast size={24} weight="light" />}
            title="No requests yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href="#bio-link"
                  className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
                >
                  Share your booking link
                </a>
                <Link
                  href={`/provider/${providerId}/availability`}
                  className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-sunken"
                >
                  Set your hours
                </Link>
              </div>
            }
          >
            When a client nearby books your kind of service, we&rsquo;ll notify
            you instantly — tap the notification to accept before the timer
            runs out.
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

      {today}

      <section id="calendar" className="scroll-mt-20">
        <SectionTitle hint="Reserved time includes a 15-minute transition period">
          Your calendar
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
              onClick={refresh}
              aria-label="Refresh"
              title="Refresh"
              className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-glam-sm border border-line bg-surface text-ink transition duration-[180ms] hover:bg-sunken"
            >
              <ArrowClockwise size={18} aria-hidden />
            </button>
          </div>

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

      {children}
    </div>
  );
}
