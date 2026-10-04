"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { formatCustomerDayTime, formatCustomerTime } from "@/lib/format";

type Day = { date: string; status: "closed" | "full" | "free" };

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

/**
 * Moving the appointment: suggest a new time from the vendor's real diary, or
 * answer the one the other side suggested. Nothing moves until it is
 * accepted, so the booking never changes under someone without them knowing.
 */
export function ReschedulePanel({
  bookingId,
  viewerRole,
  otherName,
  pending,
  canSuggest,
}: {
  bookingId: string;
  viewerRole: "CUSTOMER" | "PROVIDER";
  otherName: string;
  pending: { startAt: string; by: "CUSTOMER" | "PROVIDER" } | null;
  canSuggest: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [days, setDays] = useState<Day[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "That didn't work. Please try again.");
      setPicking(false);
      setSlot(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const load = async <T,>(query: string): Promise<T | null> => {
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/reschedule${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Couldn't load the diary.");
      return payload as T;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the diary.");
      return null;
    }
  };

  const openPicker = async () => {
    setPicking(true);
    const payload = await load<{ days: Day[] }>("");
    if (payload) setDays(payload.days);
  };

  const chooseDay = async (date: string) => {
    setDay(date);
    setSlot(null);
    setSlots(null);
    const payload = await load<{ slots: string[] }>(`?date=${date}`);
    if (payload) setSlots(payload.slots);
  };

  if (pending) {
    const theirs = pending.by !== viewerRole;
    return (
      <Card className="border-accent-500/50 p-4">
        <SectionTitle>{theirs ? "New time suggested" : "Waiting for an answer"}</SectionTitle>
        <p className="text-[15px] text-ink">
          {theirs ? `${otherName} asked to move this appointment to ` : "You suggested moving this appointment to "}
          <strong>{formatCustomerDayTime(pending.startAt)}</strong>.
        </p>
        {theirs ? (
          <p className="mt-1 text-sm text-ink-muted">Accept and the booking moves; the price stays the same.</p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">We&rsquo;ve let {otherName} know. The booking stays as it is until they accept.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {theirs ? (
            <>
              <Button onClick={() => call({ action: "accept" })} disabled={busy}>
                {busy ? "Saving…" : "Accept new time"}
              </Button>
              <Button variant="secondary" onClick={() => call({ action: "decline" })} disabled={busy}>
                Keep the original time
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => call({ action: "decline" })} disabled={busy}>
              Withdraw suggestion
            </Button>
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-warning">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  if (!canSuggest) return null;

  return (
    <Card className="p-4">
      <SectionTitle>Need a different time?</SectionTitle>
      {!picking ? (
        <>
          <p className="text-sm text-ink-muted">
            Suggest a new time and {otherName} can accept it. No fee, and the price stays the same.
          </p>
          <Button variant="secondary" onClick={openPicker} className="mt-3">
            <CalendarBlank size={16} aria-hidden />
            Suggest a new time
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          {days === null && !error ? <p className="text-sm text-ink-muted">Loading the diary…</p> : null}
          {days && days.every((entry) => entry.status !== "free") ? (
            <p className="text-sm text-ink-muted">No free times in the next few weeks. Message {otherName} to work something out.</p>
          ) : null}
          {days ? (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose a day">
              {days.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  disabled={entry.status !== "free"}
                  aria-pressed={day === entry.date}
                  onClick={() => chooseDay(entry.date)}
                  className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold ring-1 transition duration-[180ms] disabled:cursor-not-allowed disabled:opacity-40 ${
                    day === entry.date ? "bg-accent-100 text-accent-700 ring-accent-500" : "text-ink ring-line hover:bg-sunken"
                  }`}
                >
                  {dayLabel.format(new Date(`${entry.date}T12:00:00Z`))}
                </button>
              ))}
            </div>
          ) : null}
          {day && slots === null && !error ? <p className="text-sm text-ink-muted">Finding free times…</p> : null}
          {slots && slots.length === 0 ? <p className="text-sm text-ink-muted">Nothing free that day. Try another.</p> : null}
          {slots && slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="Choose a time">
              {slots.map((startAt) => (
                <button
                  key={startAt}
                  type="button"
                  aria-pressed={slot === startAt}
                  onClick={() => setSlot(startAt)}
                  className={`min-h-11 rounded-glam-sm border-[1.5px] text-sm font-semibold transition ${
                    slot === startAt ? "border-accent-500 bg-accent-100/50 text-ink" : "border-line text-ink hover:border-accent-500/60"
                  }`}
                >
                  {formatCustomerTime(startAt)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => slot && call({ action: "propose", startAt: slot })} disabled={busy || !slot}>
              {busy ? "Sending…" : slot ? `Suggest ${formatCustomerDayTime(slot)}` : "Pick a time"}
            </Button>
            <Button variant="secondary" onClick={() => setPicking(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
