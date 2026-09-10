import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Operational status tone:
 *   neutral   — pending, nothing committed yet
 *   committed — rose gold, a provider is on the hook
 *   live      — jade, something is happening in person right now
 *   money     — metal, funds have actually moved
 */
export type LifecycleTone = "neutral" | "committed" | "live" | "money";

const toneClasses: Record<LifecycleTone, string> = {
  neutral: "border border-line bg-surface-1",
  committed: "bg-rose-tint text-rose-ink",
  live: "bg-live-tint text-live-ink",
  money: "bg-metal text-metal-ink",
};

const dotClasses: Record<LifecycleTone, string> = {
  neutral: "bg-text-3",
  committed: "bg-rose",
  live: "bg-live",
  money: "bg-metal-ink",
};

/**
 * A chip on the booking lifecycle:
 * Requested → Broadcast → Accepted → Confirmed → Address Unlocked →
 * Provider En Route → Arrived → In Progress → Completed → Reviewed →
 * Payment Released.
 *
 * Only the genuinely-live states pulse, and only one pulsing element per
 * screen. The chip's colour never changes because a booking is an emergency —
 * that lives in the separate type tag.
 */
export function LifecycleChip({
  label,
  tone = "neutral",
  icon,
  pulse = false,
  className,
}: {
  label: string;
  tone?: LifecycleTone;
  /** Supply an icon *or* let the tone dot stand in — not both. */
  icon?: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-[13px] font-semibold",
        tone === "money" && "font-bold",
        toneClasses[tone],
        className,
      )}
    >
      {icon ?? (
        <span
          className={cn(
            "size-[7px] rounded-full",
            dotClasses[tone],
            pulse && "animate-breathe-fast",
          )}
        />
      )}
      {label}
    </span>
  );
}
