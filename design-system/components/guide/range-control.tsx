"use client";

import { cn } from "@/lib/cn";

/**
 * Slider for a commercial parameter.
 *
 * The emergency surcharge is admin-configurable by design — never hard-coded —
 * so the guide exposes it as a live control and every price on the page
 * recalculates from it.
 */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-pill border border-line bg-surface-1 px-4 py-2.5",
        className,
      )}
    >
      <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-text-2">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="tap-44 h-1.5 w-[140px] cursor-pointer appearance-none rounded-pill bg-surface-3 accent-[var(--gn-emergency)]"
      />
      <span
        data-numeric
        className="min-w-[42px] font-mono text-xs font-medium text-emergency-ink"
      >
        {value}
        {unit}
      </span>
    </label>
  );
}
