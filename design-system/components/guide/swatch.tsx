import { cn } from "@/lib/cn";

/** Full swatch card — name, variable, value and the rule for using it. */
export function Swatch({
  name,
  variable,
  value,
  usage,
  swatchClassName,
}: {
  name: string;
  variable: string;
  value: string;
  usage: string;
  /** The fill. A class rather than an inline colour so it tracks the theme. */
  swatchClassName: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
      <div className={cn("h-[88px]", swatchClassName)} />
      <div className="px-3.5 pt-3 pb-3.5">
        <div className="text-sm font-bold">{name}</div>
        <div className="mt-1 font-mono text-[11px] break-words text-text-2">
          {variable}
          <br />
          {value}
        </div>
        <div className="mt-2 text-[11px] leading-[1.5] text-text-3">
          {usage}
        </div>
      </div>
    </div>
  );
}

/** Compact swatch for the neutral ramp. */
export function RampSwatch({
  label,
  swatchClassName,
}: {
  label: string;
  swatchClassName: string;
}) {
  return (
    <div className="overflow-hidden rounded-tile border border-line bg-surface-2">
      <div className={cn("h-11", swatchClassName)} />
      <div className="px-2.5 py-2 font-mono text-[10px] text-text-2">
        {label}
      </div>
    </div>
  );
}
