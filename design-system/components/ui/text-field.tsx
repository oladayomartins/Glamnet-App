import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export type FieldState = "default" | "focused" | "error";

const stateClasses: Record<FieldState, string> = {
  default: "border border-line-strong",
  /* Focus is champagne — the same cue as the global focus ring. */
  focused:
    "border-[1.5px] border-champagne shadow-[0_0_0_3px_oklch(0.86_0.065_88_/_0.18)]",
  error: "border-[1.5px] border-emergency text-emergency-ink",
};

/**
 * Text input. Radius 6 — inputs are the only 6px corner in the system.
 *
 * `state` exists so the guide can show all three at once; in the app, drive
 * `error` from validation and let `:focus-within` handle the focused look.
 */
export function TextField({
  label,
  value,
  placeholder,
  state = "default",
  icon,
  error,
  muted = false,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  state?: FieldState;
  icon?: ReactNode;
  error?: string;
  /** Renders the value at text-3 — for placeholder-ish sample content. */
  muted?: boolean;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 text-[13px] font-semibold">{label}</div>
      )}
      <div
        className={cn(
          "flex min-h-12 items-center gap-2.5 rounded-input bg-surface-1 px-3.5 py-3 text-[15px]",
          "transition-[border-color,box-shadow] duration-[180ms] ease-gn",
          stateClasses[state],
          muted && state !== "error" && "text-text-3",
        )}
      >
        {icon}
        <span>{value ?? placeholder ?? ""}</span>
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emergency-ink">
          <WarningCircle size={15} />
          {error}
        </div>
      )}
    </div>
  );
}
