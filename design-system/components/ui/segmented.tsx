"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Pill-in-pill segmented control — calendar Day/Week, token export format.
 *
 * Single-select ToggleGroup rather than Tabs: the control is reused in places
 * where the thing it switches isn't a tab panel, and Radix still gives us
 * roving arrow-key focus.
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix emits "" when the active item is re-pressed; a segmented control
      // always has exactly one selection, so ignore the deselect.
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={ariaLabel}
      className={cn(
        "flex rounded-pill border border-line bg-surface-1 p-[3px]",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "tap-44 rounded-pill px-3.5 py-1.5 text-xs whitespace-nowrap",
            "transition-[background-color,color] duration-[180ms] ease-gn",
            value === option.value
              ? "bg-rose-tint font-bold text-rose-ink"
              : "font-semibold text-text-2 hover:text-text-1",
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
