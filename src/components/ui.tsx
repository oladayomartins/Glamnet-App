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
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="shrink-0 font-display text-lg font-semibold tracking-tight text-ink">
        {children}
      </h2>
      {hint ? <span className="min-w-0 text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}

/**
 * A block heading with an optional link on the right.
 *
 * The home page is five blocks in a fixed order and each one is introduced the
 * same way, so the heading is a component rather than five hand-set copies
 * that drift apart.
 */
export function BlockHeading({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        {lede ? <p className="mt-1 text-[15px] text-ink-muted">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * The EMERGENCY / NORMAL classification tag.
 *
 * Used unchanged on the customer checkout, the vendor broadcast ticket, the
 * vendor calendar, the admin list and the notification feed, so the tag reads
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
 *
 * The four treatments come straight from the lifecycle table:
 *
 *   neutral  Requested · Broadcast · Address unlocked · Completed · Reviewed
 *   rose     Accepted · Confirmed
 *   jade     Arrived, and — breathing at 1.8s — En route · In progress
 *   metal    Payment released
 */
const LIFECYCLE_CHIPS: Record<string, { label: string; tone: string; live?: boolean }> = {
  REQUESTED: { label: "Requested", tone: "neutral" },
  BROADCAST: { label: "Broadcast", tone: "neutral" },
  ACCEPTED: { label: "Accepted", tone: "rose" },
  CONFIRMED: { label: "Confirmed", tone: "rose" },
  ADDRESS_UNLOCKED: { label: "Address unlocked", tone: "neutral" },
  PROVIDER_EN_ROUTE: { label: "Vendor en route", tone: "jade", live: true },
  ARRIVED: { label: "Arrived", tone: "jade" },
  IN_PROGRESS: { label: "In progress", tone: "jade", live: true },
  COMPLETED: { label: "Completed", tone: "neutral" },
  REVIEWED: { label: "Reviewed", tone: "neutral" },
  PAYMENT_RELEASED: { label: "Payment released", tone: "metal" },
  // Outside the happy path, and outside the table. Amber, never red.
  CANCELLED: { label: "Cancelled", tone: "muted" },
  EXPIRED: { label: "Expired", tone: "muted" },
  DISPUTED: { label: "Disputed", tone: "muted" },
  NO_SHOW: { label: "Missed", tone: "muted" },
};

const CHIP_TONES: Record<string, string> = {
  neutral: "bg-sunken text-ink-muted ring-1 ring-line",
  rose: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  jade: "bg-normal-soft text-normal-ink ring-1 ring-normal/25",
  metal: "bg-metal text-metal-ink font-semibold",
  muted: "bg-sunken text-warning ring-1 ring-line",
};

export function LifecycleChip({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const chip = LIFECYCLE_CHIPS[status] ?? {
    label: status.replaceAll("_", " ").toLowerCase(),
    tone: "neutral",
  };
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium uppercase tracking-wider ${padding} ${CHIP_TONES[chip.tone]}`}
    >
      {/* A live booking gets one breathing dot — the state is still spelled out
          in words beside it, so the motion is reinforcement, not the signal. */}
      {chip.live ? (
        <span
          aria-hidden
          className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-normal"
        />
      ) : null}
      {chip.label}
    </span>
  );
}

/**
 * A plain state pill for things that are not booking lifecycle states —
 * vendor vetting, for instance. Kept separate from {@link LifecycleChip} so
 * that "approved" can never accidentally borrow a lifecycle treatment.
 */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "muted";
}) {
  const tones = {
    neutral: "bg-sunken text-ink-muted ring-1 ring-line",
    positive: "bg-normal-soft text-normal-ink ring-1 ring-normal/25",
    muted: "bg-sunken text-warning ring-1 ring-line",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${tones}`}
    >
      {children}
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
 * The duration strip (§C-04).
 *
 * `2h 00m services + 15m transition = blocks 12:00–14:15`. It is deliberately
 * spelled out as an equation and carried unchanged from the service builder
 * through reference upload, scheduling and checkout — repeating it at every
 * step is how the customer learns that the vendor's calendar is locked for
 * longer than the appointment itself.
 */
export function DurationStrip({
  serviceLabel,
  transitionMinutes,
  blockLabel,
  className = "",
}: {
  serviceLabel: string;
  transitionMinutes: number;
  blockLabel?: string;
  className?: string;
}) {
  return (
    <p
      data-numeric
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-glam-sm bg-sunken px-3 py-2 font-mono text-xs text-ink-muted ${className}`}
    >
      <span className="font-medium text-ink">{serviceLabel}</span>
      <span aria-hidden>+</span>
      <span>{transitionMinutes}m transition</span>
      {blockLabel ? (
        <>
          <span aria-hidden>=</span>
          <span className="font-medium text-ink">blocks {blockLabel}</span>
        </>
      ) : null}
    </p>
  );
}

/**
 * The emergency banner (§C-06, §C-07).
 *
 * Shown the moment a slot inside the threshold is picked, not held back until
 * checkout. Emergency is never signalled by colour alone: the word EMERGENCY
 * and the bolt travel together, and the bolt breathes at 2.2s — slower than
 * anything else on the screen.
 */
export function EmergencyBanner({
  thresholdHours,
  surchargeLabel,
  children,
}: {
  thresholdHours: number;
  surchargeLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-glam border border-emergency/30 bg-surface">
      <div className="flex items-start gap-3 bg-emergency-soft px-4 py-3">
        <span
          aria-hidden
          className="breathe-emergency mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emergency text-on-emergency"
        >
          <Lightning size={16} weight="fill" />
        </span>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-emergency-ink">
            Emergency
          </p>
          <p className="mt-1 text-[15px] text-ink">
            This appointment starts within {thresholdHours} hours, so it is
            booked at our emergency rate
            {surchargeLabel ? ` of ${surchargeLabel}` : ""}. You will see the
            full price before you authorise anything.
          </p>
        </div>
      </div>
      {children ? <div className="px-4 py-3">{children}</div> : null}
    </div>
  );
}

/** Kept as the pre-payment notice name used by the booking flow. */
export const EmergencyNotice = EmergencyBanner;

/**
 * A shimmer skeleton in the footprint of the thing that is loading.
 *
 * Never a spinner: a spinner discards the layout and then hands it back, which
 * reflows the grid twice for one fetch.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  // The default radius is only emitted when the caller has not asked for one.
  // Two `rounded-*` classes on the same element are resolved by their order in
  // the compiled stylesheet, not the order they are written here, so a caller
  // passing `rounded-full` was getting a rounded square — an avatar-shaped gap
  // that turned into a circle when the content arrived.
  const hasRadius = /(?:^|\s)rounded(?:-|$|\s)/.test(className);

  return (
    <div
      aria-hidden
      className={`shimmer ${hasRadius ? "" : "rounded-glam-sm"} ${className}`}
    />
  );
}

/**
 * Empty, error and offline states (§S-02).
 *
 * Three parts, all required: an illustration slot, one line of plain English,
 * and one action. A state with no way out is a dead end, and this component
 * makes the action impossible to forget.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "emergency";
}) {
  return (
    <div className="rounded-glam border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <span
        aria-hidden
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
          tone === "emergency"
            ? "bg-emergency-soft text-emergency-ink"
            : "bg-sunken text-brand-700"
        }`}
      >
        {icon}
      </span>
      {title ? (
        <p className="mt-4 font-display text-lg font-semibold text-ink">
          {title}
        </p>
      ) : null}
      <p className="mx-auto mt-1.5 max-w-md text-[15px] text-ink-muted">
        {children}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
