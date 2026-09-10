"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export interface SlotOption {
  value: string;
  label: string;
  /** Inside the 12-hour notice window — booking here is an EMERGENCY. */
  emergency?: boolean;
  /** No eligible provider has the full duration + 15m free. */
  unavailable?: boolean;
}

/**
 * Time-slot grid.
 *
 * A slot that would be an emergency booking says so *before* it is picked —
 * red, the bolt, and struck-through unavailability are all visible up front.
 * The customer must never discover the classification at checkout.
 */
export function SlotGrid({
  slots,
  value,
  onValueChange,
  className,
}: {
  slots: SlotOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      aria-label="Appointment time"
      className={cn(
        "grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]",
        className,
      )}
    >
      {slots.map((slot) => {
        const selected = value === slot.value;
        return (
          <ToggleGroup.Item
            key={slot.value}
            value={slot.value}
            disabled={slot.unavailable}
            aria-label={
              slot.emergency ? `${slot.label} — emergency booking` : slot.label
            }
            className={cn(
              "flex min-h-11 items-center justify-center gap-[5px] rounded-pill text-sm",
              "transition-[background-color,border-color,color] duration-[180ms] ease-gn",
              slot.unavailable
                ? "cursor-not-allowed bg-surface-3 font-semibold text-text-3 line-through"
                : selected
                  ? "border-[1.5px] border-rose bg-rose-tint font-bold text-rose-ink"
                  : slot.emergency
                    ? "border border-emergency bg-emergency-tint font-bold text-emergency-ink"
                    : "border border-line font-semibold hover:border-rose",
            )}
          >
            {slot.emergency && !slot.unavailable && <Lightning size={14} />}
            {slot.label}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}

/** The legend that must accompany the grid — colour is never the only signal. */
export function SlotLegend({ className }: { className?: string }) {
  const items = [
    { colour: "bg-rose", label: "Selected" },
    { colour: "bg-emergency", label: "Inside 12h" },
    { colour: "bg-line-strong", label: "No provider free" },
  ];
  return (
    <div
      className={cn("flex flex-wrap gap-3.5 text-[11px] text-text-2", className)}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", item.colour)} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
