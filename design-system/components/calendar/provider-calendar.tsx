"use client";

import { useState } from "react";
import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { Segmented } from "@/components/ui/segmented";
import { TRANSITION_MINUTES } from "@/lib/booking";
import { cn } from "@/lib/cn";

/**
 * Vertical scale of the day view. One hour = 34px, and every block's geometry
 * is derived from its start and end time — not hand-placed — so a calendar
 * rendered from real bookings is guaranteed to agree with the times printed
 * inside it.
 */
const HOUR_HEIGHT = 34;

/**
 * A 15-minute buffer is only ~8px at this scale, which is too thin for the
 * hatch to read as a hatch. The transition block is the visual signature of
 * GlamNet's availability engine, so it gets a legibility floor instead of
 * being allowed to collapse. Never hide it.
 */
const MIN_TRANSITION_HEIGHT = 14;

export type CalendarEventKind = "service" | "emergency" | "blocked";

export interface CalendarEvent {
  id: string;
  /** "HH:MM", 24-hour — the provider app is always 24-hour. */
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  kind: CalendarEventKind;
  /**
   * Draws the hatched transition block immediately after `end`. Confirmed
   * bookings always carry one; a conflicting emergency request being previewed
   * does not, because it was never granted the slot.
   */
  transition?: boolean;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatHour(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

/**
 * Provider day view.
 *
 * Booked time is always drawn as service block + hatched transition block. A
 * provider must never be offered work that overlaps either part.
 */
export function ProviderCalendar({
  date,
  events,
  startHour = 11,
  endHour = 18,
  className,
}: {
  date: string;
  events: CalendarEvent[];
  startHour?: number;
  endHour?: number;
  className?: string;
}) {
  const [view, setView] = useState<"day" | "week">("day");

  const originMinutes = startHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => i);
  const gridHeight = hours.length * HOUR_HEIGHT;

  const offsetOf = (time: string) =>
    ((toMinutes(time) - originMinutes) / 60) * HOUR_HEIGHT;

  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-2 p-[18px]",
        className,
      )}
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[15px] font-bold">{date}</div>
        <Segmented
          ariaLabel="Calendar view"
          value={view}
          onValueChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
          ]}
        />
      </div>

      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-2.5 font-mono text-[11px] text-text-3">
        {/* Hour axis */}
        <div style={{ height: gridHeight }}>
          {hours.map((i) => (
            <div key={i} style={{ height: HOUR_HEIGHT }}>
              {formatHour(originMinutes + i * 60)}
            </div>
          ))}
        </div>

        {/* Event track */}
        <div className="relative" style={{ height: gridHeight }}>
          {hours.map((i) => (
            <div
              key={i}
              className="absolute right-0 left-0 border-t border-line"
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            />
          ))}

          {events.map((event) => {
            const top = offsetOf(event.start);
            const height = offsetOf(event.end) - top;
            const transitionHeight = Math.max(
              MIN_TRANSITION_HEIGHT,
              (TRANSITION_MINUTES / 60) * HOUR_HEIGHT,
            );

            return (
              <div key={event.id}>
                <EventBlock event={event} top={top} height={height} />
                {event.transition && (
                  <TransitionBlock
                    top={offsetOf(event.end) + 1}
                    height={transitionHeight}
                    label={`${event.end}–${addMinutes(event.end, TRANSITION_MINUTES)} transition · locked`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function addMinutes(time: string, minutes: number): string {
  const total = toMinutes(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function EventBlock({
  event,
  top,
  height,
}: {
  event: CalendarEvent;
  top: number;
  height: number;
}) {
  if (event.kind === "blocked") {
    return (
      <div
        className="absolute right-0 left-0 flex items-center overflow-hidden rounded-lg bg-[repeating-linear-gradient(45deg,var(--gn-surface-3)_0_5px,var(--gn-surface-1)_5px_10px)] pl-2.5 font-sans text-[10px] text-text-2"
        style={{ top: top + 2, height: Math.max(height, 28) }}
      >
        {event.title}
      </div>
    );
  }

  const emergency = event.kind === "emergency";

  return (
    <div
      className={cn(
        "absolute right-0 left-0 overflow-hidden rounded-[10px] px-2.5 py-[7px]",
        emergency
          ? "border-l-[3px] border-emergency bg-emergency-tint"
          : "border-l-[3px] border-rose bg-rose-tint",
      )}
      style={{ top: top + 2, height: height - 4 }}
    >
      <div
        className={cn(
          "flex items-center gap-[5px] font-sans font-bold",
          emergency
            ? "text-[11px] tracking-[0.05em] text-emergency-ink"
            : "text-xs text-rose-ink",
        )}
      >
        {emergency && <Lightning size={13} />}
        {event.title}
      </div>
      {event.subtitle && (
        <div
          className={cn(
            "mt-0.5 text-[10px]",
            emergency
              ? "text-emergency-ink opacity-85"
              : "text-rose-ink opacity-80",
          )}
        >
          {event.subtitle}
        </div>
      )}
    </div>
  );
}

function TransitionBlock({
  top,
  height,
  label,
}: {
  top: number;
  height: number;
  label: string;
}) {
  return (
    <>
      <div
        aria-label={label}
        className="absolute right-0 left-0 rounded-[5px] bg-[repeating-linear-gradient(45deg,var(--gn-rose)_0_4px,var(--gn-rose-tint)_4px_8px)] opacity-75"
        style={{ top, height }}
      />
      <div
        className="absolute right-0 left-0 font-sans text-[10px] text-text-2"
        style={{ top: top + height + 3 }}
      >
        {label}
      </div>
    </>
  );
}
