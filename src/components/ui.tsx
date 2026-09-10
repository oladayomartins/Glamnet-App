import type { ReactNode } from "react";
import { Lightning } from "@phosphor-icons/react/dist/ssr";

/**
 * Shared primitives. Every visual value here comes from the design tokens in
 * globals.css — no component hard-codes a colour, so swapping in the real
 * brand guide is a single-file change.
 */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-glam border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {children}
      </h2>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}

/**
 * The EMERGENCY / NORMAL classification tag.
 *
 * Used unchanged on the customer checkout, the provider broadcast ticket, the
 * provider calendar, the admin list and the notification feed, so the tag reads
 * identically everywhere the spec requires it (§4, §6, §10, §11).
 */
export function BookingTypeTag({
  bookingType,
  size = "md",
}: {
  bookingType: string;
  size?: "sm" | "md";
}) {
  const isEmergency = bookingType === "EMERGENCY";
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-mono font-medium uppercase tracking-wider ${padding} ${
        isEmergency
          ? "bg-emergency-soft text-emergency-ink ring-1 ring-emergency/30"
          : "bg-normal-soft text-normal-ink ring-1 ring-normal/20"
      }`}
    >
      {/* The bolt is a real icon, not an emoji: emoji render differently on
          every platform and the emergency cue must be identical everywhere. */}
      {isEmergency ? (
        <>
          <Lightning size={12} weight="bold" />
          Emergency
        </>
      ) : (
        "Normal"
      )}
    </span>
  );
}

/**
 * The operational lifecycle chip.
 *
 * Deliberately never uses the emergency colour. Brand guide: signal red is
 * reserved for the EMERGENCY booking *type*, and type and operational status
 * are two separate fields — an EMERGENCY booking keeps its red tag through
 * every lifecycle state while this chip changes independently. A cancelled
 * booking rendered in red would read as an emergency one.
 */
export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "CANCELLED" || status === "DISPUTED"
      ? "bg-sunken text-warning"
      : status === "PAYMENT_RELEASED" || status === "COMPLETED" || status === "REVIEWED"
        ? "bg-normal-soft text-normal-ink"
        : "bg-sunken text-ink-muted";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "emergency";
}) {
  const styles = {
    // Metal is reserved for the single primary action on a screen (§02, §06).
    // If a screen needs two prominent buttons, the second is `secondary`.
    primary: "bg-metal text-metal-ink font-bold hover:brightness-105",
    secondary: "bg-surface text-ink ring-1 ring-line hover:bg-sunken",
    ghost: "text-brand-700 hover:bg-brand-50",
    emergency: "bg-emergency text-on-emergency hover:brightness-110",
  }[variant];

  return (
    <button
      {...props}
      // Pill for every button; 44px minimum tap target; press is scale .98
      // over 120ms — no bounce. (§04, §06, §11)
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-[180ms] ease-glam active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The pre-payment emergency notice (spec §4). Deliberately verbose: the
 * customer must not discover the surcharge only after submitting.
 */
export function EmergencyNotice({
  thresholdHours,
  surchargeLabel,
}: {
  thresholdHours: number;
  surchargeLabel?: string;
}) {
  return (
    <div className="rounded-glam border-l-4 border-emergency bg-emergency-soft p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-emergency-ink">
        <Lightning size={16} weight="bold" />
        Emergency booking
      </p>
      <p className="mt-1 text-sm text-ink">
        Your appointment is within {thresholdHours} hours and will be subject to
        our emergency booking rate
        {surchargeLabel ? ` (${surchargeLabel})` : ""}.
      </p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-glam border border-dashed border-line bg-surface/60 p-8 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}
