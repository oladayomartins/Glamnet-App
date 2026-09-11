"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDay, formatTime } from "@/lib/format";

const WEEKDAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export interface WorkingWindow {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface BlockedPeriod {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
}

/** One editable row per weekday. */
interface DayRow {
  dayOfWeek: number;
  working: boolean;
  start: string;
  end: string;
}

/**
 * Availability and blocked periods (§P-04).
 *
 * One shift per day, which is what the editor can express honestly: the data
 * model allows several, but a provider who genuinely splits a day is better
 * served by blocking the gap than by a second pair of time fields they will
 * mis-set. Anything already saved with two shifts still works — this screen
 * shows the widest span and says so rather than silently dropping one.
 */
export function AvailabilityEditor({
  providerId,
  sector,
  city,
  windows,
  blocks,
}: {
  providerId: string;
  sector: string;
  city: string;
  windows: WorkingWindow[];
  blocks: BlockedPeriod[];
}) {
  const router = useRouter();

  const [rows, setRows] = useState<DayRow[]>(() =>
    WEEKDAYS.map(({ day }) => {
      const forDay = windows.filter((window) => window.dayOfWeek === day);
      if (forDay.length === 0) {
        return { dayOfWeek: day, working: false, start: "09:00", end: "18:00" };
      }
      return {
        dayOfWeek: day,
        working: true,
        start: toClock(Math.min(...forDay.map((w) => w.startMinute))),
        end: toClock(Math.max(...forDay.map((w) => w.endMinute))),
      };
    }),
  );

  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursSaved, setHoursSaved] = useState(false);

  const splitDays = WEEKDAYS.filter(
    ({ day }) => windows.filter((window) => window.dayOfWeek === day).length > 1,
  ).map(({ label }) => label);

  const update = (dayOfWeek: number, patch: Partial<DayRow>) => {
    setHoursSaved(false);
    setRows((current) =>
      current.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row,
      ),
    );
  };

  const saveHours = async () => {
    setSavingHours(true);
    setHoursError(null);
    try {
      const payload = rows
        .filter((row) => row.working)
        .map((row) => ({
          dayOfWeek: row.dayOfWeek,
          startMinute: toMinutes(row.start),
          endMinute: toMinutes(row.end),
        }));

      const bad = payload.find((window) => window.startMinute >= window.endMinute);
      if (bad) {
        throw new Error(
          `${WEEKDAYS.find((d) => d.day === bad.dayOfWeek)?.label} ends before it starts.`,
        );
      }

      const response = await fetch(
        `/api/providers/${providerId}/working-hours`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ windows: payload }),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "Could not save your hours.");
      }
      setHoursSaved(true);
      router.refresh();
    } catch (cause) {
      setHoursError(
        cause instanceof Error ? cause.message : "Could not save your hours.",
      );
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* --- Weekly hours ---------------------------------------------- */}
      <section>
        <SectionTitle hint="Applies to times we offer from now on">
          Working hours
        </SectionTitle>

        <Card className="divide-y divide-line">
          {WEEKDAYS.map(({ day, label }) => {
            const row = rows.find((entry) => entry.dayOfWeek === day);
            if (!row) return null;
            return (
              <div
                key={day}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={row.working}
                    onChange={(event) =>
                      update(day, { working: event.target.checked })
                    }
                    className="size-5 accent-[var(--glam-rose-700)]"
                  />
                  <span className="text-[15px] font-medium text-ink">
                    {label}
                  </span>
                </label>

                {row.working ? (
                  <div className="flex items-center gap-2">
                    <TimeInput
                      label={`${label} start`}
                      value={row.start}
                      onChange={(start) => update(day, { start })}
                    />
                    <span aria-hidden className="text-ink-muted">
                      –
                    </span>
                    <TimeInput
                      label={`${label} end`}
                      value={row.end}
                      onChange={(end) => update(day, { end })}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-ink-muted">Not working</span>
                )}
              </div>
            );
          })}
        </Card>

        {splitDays.length > 0 ? (
          <p className="mt-2 text-xs text-ink-muted">
            {splitDays.join(", ")}{" "}
            {splitDays.length === 1 ? "has" : "have"} more than one shift saved.
            This editor shows the full span; saving here will replace them with
            a single shift.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={saveHours} disabled={savingHours}>
            {savingHours ? "Saving…" : "Save hours"}
          </Button>
          {hoursSaved ? (
            <span className="text-sm text-normal-ink" role="status">
              Saved.
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          Changing your hours only affects the times we offer customers from now
          on. Bookings already in your calendar stay exactly where they are.
        </p>

        {hoursError ? (
          <p role="alert" className="mt-3 text-sm text-warning">
            {hoursError}
          </p>
        ) : null}
      </section>

      {/* --- Blocked periods ------------------------------------------- */}
      <BlockedPeriods
        providerId={providerId}
        blocks={blocks}
        onChanged={() => router.refresh()}
      />

      {/* --- Sector coverage -------------------------------------------- */}
      <section>
        <SectionTitle>Sector coverage</SectionTitle>
        <Card className="p-4">
          <p className="text-[15px] text-ink">
            You cover <span className="font-semibold">{sector}</span> in {city}.
          </p>
          {/* Read-only, because it is: a provider belongs to exactly one hub in
              this build, and their sector is set during vetting. Offering a
              picker that could not be honoured would be worse than saying so. */}
          <p className="mt-2 text-sm text-ink-muted">
            Coverage is set when your application is approved. To work a
            different sector, contact us — moving you would change which
            broadcasts you receive.
          </p>
        </Card>
      </section>
    </div>
  );
}

function BlockedPeriods({
  providerId,
  blocks,
  onChanged,
}: {
  providerId: string;
  blocks: BlockedPeriod[];
  onChanged: () => void;
}) {
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/providers/${providerId}/time-off`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          reason: reason.trim() || "Unavailable",
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "Could not block that period.");
      }
      setStartAt("");
      setEndAt("");
      setReason("");
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not block that period.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (blockId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/providers/${providerId}/time-off`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blockId }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "Could not remove that.");
      }
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle hint={`${blocks.length} blocked`}>
        Blocked periods
      </SectionTitle>

      {blocks.length === 0 ? (
        <EmptyState icon={<Trash size={24} weight="light" />}>
          Nothing blocked out. Add a period below and we will not offer any of
          it to customers.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p data-numeric className="text-[15px] text-ink">
                  {formatDay(block.startAt)} {formatTime(block.startAt)} –{" "}
                  {formatDay(block.endAt)} {formatTime(block.endAt)}
                </p>
                <p className="text-sm text-ink-muted">{block.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(block.id)}
                disabled={busy}
                aria-label={`Remove the block on ${formatDay(block.startAt)}`}
                className="tap-44 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted transition hover:text-ink disabled:opacity-50"
              >
                <Trash size={16} weight="light" aria-hidden />
                Remove
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-ink">From</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">To</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Reason</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Holiday"
              className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <Button
          onClick={add}
          disabled={busy || !startAt || !endAt}
          className="mt-3"
        >
          {busy ? "Saving…" : "Block this period"}
        </Button>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-warning">
            {error}
          </p>
        ) : null}
      </Card>
    </section>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-glam-input border border-line bg-surface px-2 text-[15px] text-ink outline-none focus:border-brand-400"
      />
    </label>
  );
}

/** 540 -> "09:00". */
function toClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
    minute % 60,
  ).padStart(2, "0")}`;
}

/** "09:00" -> 540. */
function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}
