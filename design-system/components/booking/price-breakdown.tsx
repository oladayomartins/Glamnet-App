import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { formatGbp } from "@/lib/booking";
import { cn } from "@/lib/cn";

export interface PriceLine {
  label: string;
  amount: number;
  /** The emergency surcharge row — named, never folded into a subtotal. */
  emergency?: boolean;
}

/**
 * Price breakdown.
 *
 * Line items are never collapsed and surcharges are always named. Totals sit
 * in champagne — the only place money takes brand colour — except on an
 * emergency booking, where the total inherits the red so the surcharge cannot
 * be missed.
 */
export function PriceBreakdown({
  lines,
  total,
  emergency = false,
  totalSize = 22,
  className,
}: {
  lines: PriceLine[];
  total: number;
  emergency?: boolean;
  /** 22px in the booking flow, 20px in the tighter checkout cards. */
  totalSize?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2.5 text-sm", className)}>
      {lines.map((line) => (
        <div
          key={line.label}
          className={cn(
            "flex justify-between gap-3",
            line.emergency && "font-bold text-emergency-ink",
          )}
        >
          {line.emergency ? (
            <span className="flex items-center gap-1.5">
              <Lightning size={14} />
              {line.label}
            </span>
          ) : (
            <span className="text-text-2">{line.label}</span>
          )}
          <span data-numeric>{formatGbp(line.amount)}</span>
        </div>
      ))}

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
        {/* The label steps up with the figure so the row stays optically
            balanced at both sizes. */}
        <span
          className={cn("font-bold", totalSize >= 22 && "text-[15px]")}
        >
          Total
        </span>
        <span
          data-numeric
          className={cn(
            "font-bold",
            emergency ? "text-emergency-ink" : "text-gold-text",
          )}
          style={{
            fontSize: totalSize,
            letterSpacing: totalSize >= 22 ? "-0.02em" : undefined,
          }}
        >
          {formatGbp(total)}
        </span>
      </div>
    </div>
  );
}
