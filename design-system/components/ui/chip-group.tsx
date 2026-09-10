"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export interface ChipOption {
  value: string;
  label: string;
  /** Unavailable options stay visible — the customer needs to know they exist. */
  disabled?: boolean;
}

/**
 * Multi-select service chips. Built on Radix ToggleGroup so arrow-key roving
 * focus and `aria-pressed` come for free.
 *
 * Selected chips take rose — committed, but not yet money. Metal stays
 * reserved for the one primary action on the screen.
 */
export function ChipGroup({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  options: ChipOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="multiple"
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "tap-44 flex items-center gap-1.5 rounded-pill px-[15px] py-[9px] text-[13px]",
              "transition-[border-color,background-color,color] duration-[180ms] ease-gn",
              option.disabled
                ? "cursor-not-allowed border border-line font-semibold text-text-3"
                : selected
                  ? "border-[1.5px] border-rose bg-rose-tint font-bold text-rose-ink"
                  : "border border-line-strong font-semibold hover:border-rose",
            )}
          >
            {selected && !option.disabled && <Check size={14} />}
            {option.label}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
