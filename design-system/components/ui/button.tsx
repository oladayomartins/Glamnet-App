import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "metal"
  | "emergency"
  | "secondary"
  | "pending"
  | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  /* Metal is reserved for the single primary action on a screen. */
  metal: "bg-metal text-metal-ink font-bold hover:brightness-105",
  /* Emergency red, and only for emergency. Always paired with the bolt. */
  emergency:
    "bg-emergency text-emergency-on font-bold hover:brightness-[1.08]",
  secondary:
    "border border-line-strong text-text-1 font-semibold hover:border-rose hover:text-rose",
  /* In-flight action — the shimmer answers "is it working?". */
  pending:
    "bg-rose-tint text-rose-ink font-semibold shimmer-overlay animate-shimmer cursor-progress",
  ghost: "text-text-1 font-semibold hover:text-rose",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Renders the disabled treatment. Give it a reason, not just a grey pill. */
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Every control is at least 44px of tap target; buttons sit at 48px.
 * Press is scale .98 over 120ms — no bounce.
 */
export function Button({
  variant = "secondary",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-pill px-4 text-center text-[15px]",
        "transition-[filter,color,border-color,transform] duration-[180ms] ease-gn",
        "active:scale-[0.98] active:duration-[120ms]",
        disabled
          ? "cursor-not-allowed bg-surface-3 font-semibold text-text-3"
          : variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
