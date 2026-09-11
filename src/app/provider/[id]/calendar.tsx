"use client";

import Link from "next/link";
import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { BookingTypeTag, EmptyState, LifecycleChip } from "@/components/ui";
import { formatDay, formatDuration, formatMoney, formatTime } from "@/lib/format";

export interface CalendarEntry {
  id: string;
  bookingType: string;
  status: string;
  appointmentStartAt: string;
  appointmentEndAt: string;
  reservedUntilAt: string;
  serviceDurationMinutes: number;
  reservedDurationMinutes: number;
  customerName: string;
  sector: string;
  services: string[];
  earningsMinor: number;
}

export interface CalendarBlock {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
}

export interface CalendarPayload {
  view: "day" | "week";
  from: string;
  to: string;
  transitionBufferMinutes: number;
  workingWindows: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  entries: CalendarEntry[];
  blocks: CalendarBlock[];
}

const MINUTES_PER_DAY = 24 * 60;

export function ProviderCalendar({ calendar }: { calendar: CalendarPayload }) {
  return calendar.view === "day" ? (
    <DayView calendar={calendar} />
  ) : (
    <WeekView calendar={calendar} />
  );
}

/**
 * Day view: a proportional timeline.
 *
 * Each booking is drawn twice over — the solid block is the billable service,
 * the hatched tail is the 15-minute transition period. Both are part of the
 * calendar lock, so the provider can see exactly why a following slot is not
 * offered to them.
 */
function DayView({ calendar }: { calendar: CalendarPayload }) {
  const dayStart = new Date(calendar.from);
  const dayOfWeek = dayStart.getDay();

  const shifts = calendar.workingWindows.filter(
    (window) => window.dayOfWeek === dayOfWeek,
  );

  // Frame the timeline to the working day, widened to cover any booking or
  // block that falls outside it.
  const bounds = shifts.reduce(
    (range, shift) => ({
      start: Math.min(range.start, shift.startMinute),
      end: Math.max(range.end, shift.endMinute),
    }),
    { start: 8 * 60, end: 20 * 60 },
  );

  for (const entry of calendar.entries) {
    bounds.start = Math.min(bounds.start, minutesInto(dayStart, entry.appointmentStartAt));
    bounds.end = Math.max(bounds.end, minutesInto(dayStart, entry.reservedUntilAt));
  }

  // Half an hour of headroom at each end keeps the first and last hour labels
  // clear of the frame edge instead of being clipped by it.
  const windowStart = Math.max(0, Math.floor(bounds.start / 60) * 60 - 30);
  const windowEnd = Math.min(MINUTES_PER_DAY, Math.ceil(bounds.end / 60) * 60 + 30);
  const span = Math.max(60, windowEnd - windowStart);

  const firstHour = Math.ceil(windowStart / 60) * 60;
  const hours = Array.from(
    { length: Math.floor((windowEnd - firstHour) / 60) + 1 },
    (_, index) => firstHour + index * 60,
  );

  const percent = (minute: number) => ((minute - windowStart) / span) * 100;

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink">
        {formatDay(dayStart)}
        {shifts.length === 0 ? (
          <span className="ml-2 text-xs font-normal text-ink-muted">
            Not a working day
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-ink-muted">
            Working {formatClock(shifts[0].startMinute)}–
            {formatClock(shifts[0].endMinute)}
          </span>
        )}
      </p>

      <div className="relative h-72 overflow-hidden rounded-glam-sm border border-line bg-sunken">
        {/* Hour gridlines */}
        {hours.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 border-t border-line/70"
            style={{ top: `${percent(minute)}%` }}
          >
            <span className="absolute -top-2 left-1 bg-sunken px-1 text-[10px] text-ink-muted">
              {formatClock(minute)}
            </span>
          </div>
        ))}

        {/* Working windows */}
        {shifts.map((shift, index) => (
          <div
            key={index}
            className="absolute left-12 right-2 rounded bg-surface/70"
            style={{
              top: `${percent(shift.startMinute)}%`,
              height: `${(shift.endMinute - shift.startMinute) / span * 100}%`,
            }}
          />
        ))}

        {/* Blocked periods — neutral hatch, never the rose one. */}
        {calendar.blocks.map((block) => (
          <div
            key={block.id}
            title={block.reason}
            className="hatch-blocked absolute left-12 right-2 overflow-hidden rounded-glam-sm border border-line"
            style={{
              top: `${percent(minutesInto(dayStart, block.startAt))}%`,
              height: `${spanPercent(dayStart, block.startAt, block.endAt, span)}%`,
            }}
          >
            <span className="block truncate bg-surface/80 px-1.5 text-[10px] text-ink-muted">
              Unavailable — {block.reason.toLowerCase()}
            </span>
          </div>
        ))}

        {/* Bookings, with the transition buffer drawn as a separate tail */}
        {calendar.entries.map((entry) => {
          const isEmergency = entry.bookingType === "EMERGENCY";
          return (
            <div key={entry.id}>
              {/* The service block: a tint with a 3px left border, not a
                  solid fill. A solid fill would win the screen from the
                  hatched tail, and the tail is the part that explains why the
                  next slot is not on offer. */}
              <Link
                href={`/bookings/${entry.id}`}
                className={`absolute left-12 right-2 overflow-hidden rounded-glam-sm border-l-[3px] px-2 py-0.5 text-[11px] leading-tight transition duration-[180ms] hover:brightness-[0.98] ${
                  isEmergency
                    ? "border-l-emergency bg-emergency-soft text-emergency-ink"
                    : "border-l-brand-700 bg-brand-50 text-brand-700"
                }`}
                style={{
                  top: `${percent(minutesInto(dayStart, entry.appointmentStartAt))}%`,
                  height: `${spanPercent(dayStart, entry.appointmentStartAt, entry.appointmentEndAt, span)}%`,
                }}
              >
                <span className="flex items-center gap-1 truncate font-semibold">
                  {isEmergency ? (
                    <>
                      <Lightning size={11} weight="fill" aria-hidden />
                      EMERGENCY · {formatTime(entry.appointmentStartAt)}
                    </>
                  ) : (
                    <>
                      {entry.customerName} ·{" "}
                      <span data-numeric>
                        {formatTime(entry.appointmentStartAt)}
                      </span>
                    </>
                  )}
                </span>
                <span className="block truncate opacity-80">{entry.sector}</span>
              </Link>

              {/* Hatched, not a flat tint: the hatch is the visual signature
                  of the availability engine and must stay legible. It is
                  labelled, because an unlabelled stripe is decoration. [§09] */}
              <div
                className={`absolute left-12 right-2 overflow-hidden rounded-b-glam-sm border-b border-l-[3px] border-r ${
                  isEmergency
                    ? "border-emergency/50 border-l-emergency hatch-transition-emergency"
                    : "border-brand-700/40 border-l-brand-700 hatch-transition"
                }`}
                style={{
                  top: `${percent(minutesInto(dayStart, entry.appointmentEndAt))}%`,
                  height: `${spanPercent(dayStart, entry.appointmentEndAt, entry.reservedUntilAt, span)}%`,
                }}
              >
                <span
                  data-numeric
                  className="block truncate bg-surface/85 px-1.5 text-[10px] font-medium text-ink-muted"
                >
                  {formatTime(entry.appointmentEndAt)}–
                  {formatTime(entry.reservedUntilAt)} transition · locked
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Legend bufferMinutes={calendar.transitionBufferMinutes} />
      <EntryList entries={calendar.entries} />
    </div>
  );
}

/** Week view: seven day columns, each listing that day's commitments. */
function WeekView({ calendar }: { calendar: CalendarPayload }) {
  const weekStart = new Date(calendar.from);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    return {
      date: day,
      isWorking: calendar.workingWindows.some(
        (window) => window.dayOfWeek === day.getDay(),
      ),
      entries: calendar.entries.filter((entry) => {
        const startAt = new Date(entry.appointmentStartAt);
        return startAt >= day && startAt < nextDay;
      }),
      blocks: calendar.blocks.filter((block) => {
        const startAt = new Date(block.startAt);
        return startAt >= day && startAt < nextDay;
      }),
    };
  });

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={`min-h-28 rounded-glam-sm border p-2 ${
              day.isWorking ? "border-line bg-surface" : "border-line bg-sunken"
            }`}
          >
            <p className="text-xs font-semibold text-ink">
              {day.date.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
              })}
            </p>
            {!day.isWorking ? (
              <p className="mt-1 text-[10px] text-ink-muted">Not working</p>
            ) : null}

            <div className="mt-1.5 space-y-1">
              {day.entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/bookings/${entry.id}`}
                  className={`block rounded-glam-sm border-l-[3px] px-1.5 py-1 text-[10px] font-semibold ${
                    entry.bookingType === "EMERGENCY"
                      ? "border-l-emergency bg-emergency-soft text-emergency-ink"
                      : "border-l-brand-700 bg-brand-50 text-brand-700"
                  }`}
                >
                  <span className="flex items-center gap-0.5" data-numeric>
                    {entry.bookingType === "EMERGENCY" ? (
                      <Lightning size={10} weight="fill" aria-hidden />
                    ) : null}
                    {formatTime(entry.appointmentStartAt)}–
                    {formatTime(entry.appointmentEndAt)}
                  </span>
                  {/* The transition is written out rather than drawn: at week
                      scale a 15-minute hatch would be a single pixel. */}
                  <span
                    data-numeric
                    className="mt-0.5 block font-normal opacity-75"
                  >
                    +{calendar.transitionBufferMinutes}m to{" "}
                    {formatTime(entry.reservedUntilAt)}
                  </span>
                </Link>
              ))}
              {day.blocks.map((block) => (
                <p
                  key={block.id}
                  className="hatch-blocked rounded-glam-sm border border-line px-1.5 py-1 text-[10px] text-ink-muted"
                >
                  <span className="bg-surface/85">
                    Unavailable — {block.reason.toLowerCase()}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Legend bufferMinutes={calendar.transitionBufferMinutes} />
      <EntryList entries={calendar.entries} />
    </div>
  );
}

function Legend({ bufferMinutes }: { bufferMinutes: number }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-4 rounded-[3px] border-l-[3px] border-l-brand-700 bg-brand-50"
        />{" "}
        Normal
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-4 rounded-[3px] border-l-[3px] border-l-emergency bg-emergency-soft"
        />{" "}
        Emergency
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="hatch-blocked h-2.5 w-4 rounded-[3px] ring-1 ring-line"
        />{" "}
        Blocked
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="hatch-transition h-2.5 w-2.5 rounded opacity-75 ring-1 ring-brand-700/40"
        />{" "}
        {bufferMinutes}-minute transition period
      </span>
    </p>
  );
}

function EntryList({ entries }: { entries: CalendarEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState>No bookings in this period.</EmptyState>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link
            href={`/bookings/${entry.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-glam-sm border border-line bg-surface p-3 transition hover:border-brand-400"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">
                  {formatDay(entry.appointmentStartAt)}{" "}
                  {formatTime(entry.appointmentStartAt)}–
                  {formatTime(entry.appointmentEndAt)}
                </span>
                <BookingTypeTag bookingType={entry.bookingType} size="sm" />
                <LifecycleChip status={entry.status} />
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                {entry.customerName} · {entry.services.join(" + ")} ·{" "}
                {entry.sector}
              </p>
              <p className="text-xs text-ink-muted">
                Calendar held until {formatTime(entry.reservedUntilAt)} (
                {formatDuration(entry.reservedDurationMinutes)} incl. transition)
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink">
              {formatMoney(entry.earningsMinor)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Minutes from local midnight of `dayStart` to `iso`. */
function minutesInto(dayStart: Date, iso: string): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

/** Height of `[fromIso, toIso)` as a percentage of a `span`-minute timeline. */
function spanPercent(
  dayStart: Date,
  fromIso: string,
  toIso: string,
  span: number,
): number {
  const minutes = minutesInto(dayStart, toIso) - minutesInto(dayStart, fromIso);
  return Math.max(1.6, (minutes / span) * 100);
}

/** 540 -> "09:00". */
function formatClock(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
