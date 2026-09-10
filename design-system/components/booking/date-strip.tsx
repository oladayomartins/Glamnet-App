"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export interface DateOption {
  value: string;
  weekday: string;
  day: string;
  /** No provider in the sector is free that day. */
  unavailable?: boolean;
}

/**
 * Horizontal date strip — step one of "date, time, duration, price, in that
 * order, always".
 *
 * The selected date is the one place in the booking flow where metal appears
 * before checkout: it is the screen's primary commitment.
 */
export function DateStrip({
  dates,
  value,
  onValueChange,
  className,
}: {
  dates: DateOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      aria-label="Appointment date"
      className={cn("flex gap-2", className)}
    >
      {dates.map((date) => {
        const selected = value === date.value;
        return (
          <ToggleGroup.Item
            key={date.value}
            value={date.value}
            disabled={date.unavailable}
            className={cn(
              "min-w-0 flex-1 rounded-tile px-1 py-2.5 text-center",
              "transition-[background-color,border-color,color] duration-[180ms] ease-gn",
              selected
                ? "bg-metal text-metal-ink"
                : date.unavailable
                  ? "cursor-not-allowed border border-line text-text-3"
                  : "border border-line hover:border-rose",
            )}
          >
            <div
              className={cn(
                "text-[11px]",
                selected
                  ? "opacity-[0.72]"
                  : date.unavailable
                    ? ""
                    : "text-text-3",
              )}
            >
              {date.weekday}
            </div>
            <div className="text-[17px] font-bold">{date.day}</div>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
