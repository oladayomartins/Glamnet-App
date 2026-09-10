import { Hourglass } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/**
 * Duration summary — the customer-facing statement of what the booking
 * actually reserves.
 *
 * The 15 minutes after a job are part of the job, so the blocked window is
 * always shown alongside the service time. Never surface one without the other.
 */
export function DurationSummary({
  serviceDuration,
  transitionLabel = "+ 15m transition",
  blockedWindow,
  className,
}: {
  serviceDuration: string;
  transitionLabel?: string;
  blockedWindow: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-tile border border-line bg-surface-1 px-3.5 py-3 text-sm font-semibold",
        className,
      )}
    >
      <Hourglass size={17} />
      {serviceDuration} services{" "}
      <span className="font-normal text-text-2">
        {transitionLabel} = blocks {blockedWindow}
      </span>
    </div>
  );
}
