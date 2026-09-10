import {
  Hourglass,
  Lightning,
  MapPin,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { formatGbp } from "@/lib/booking";
import { cn } from "@/lib/cn";

/**
 * The provider broadcast ticket for an emergency request.
 *
 * A provider only sees this if they can actually accommodate the service
 * duration plus the 15-minute transition — eligibility is decided before the
 * broadcast, never by the provider tapping accept. Earnings, including the
 * surge component, are shown before acceptance, not after.
 */
export function BroadcastTicket({
  appointment,
  services,
  duration,
  sector,
  earnings,
  surge,
  countdown,
  /** 0–1. How much of the acceptance window is left. */
  progress,
  className,
}: {
  appointment: string;
  services: string;
  duration: string;
  sector: string;
  earnings: number;
  surge: number;
  countdown: string;
  progress: number;
  className?: string;
}) {
  const rows = [
    { icon: <Sparkle size={17} weight="light" />, content: services },
    { icon: <Hourglass size={17} weight="light" />, content: duration },
    { icon: <MapPin size={17} weight="light" />, content: sector },
  ];

  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-1 p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.06em] text-emergency-ink">
          <Lightning size={15} />
          EMERGENCY BOOKING
        </div>
        <div
          data-numeric
          className="rounded-pill bg-emergency px-2.5 py-[5px] font-mono text-xs text-emergency-on"
        >
          {countdown}
        </div>
      </div>

      <div className="mt-3.5 text-[19px] font-bold tracking-[-0.02em]">
        {appointment}
      </div>

      <div className="mt-3.5 grid gap-2 text-[13px] text-text-1">
        {rows.map((row) => (
          <div key={row.content} className="flex items-center gap-2">
            {row.icon}
            {row.content}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Wallet size={17} weight="light" />
          Earnings{" "}
          <span className="font-bold text-gold-text">
            {formatGbp(earnings)}
          </span>{" "}
          <span className="text-emergency-ink">
            incl. {formatGbp(surge)} surge
          </span>
        </div>
      </div>

      <div
        className="mt-[18px] h-1.5 overflow-hidden rounded-pill bg-surface-3"
        role="progressbar"
        aria-label="Time left to accept"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-pill bg-emergency transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
        />
      </div>

      <Button variant="emergency" className="mt-4">
        ACCEPT EMERGENCY BOOKING
      </Button>

      <div className="mt-3.5 font-mono text-[10px] tracking-[0.06em] uppercase text-text-3">
        Provider broadcast ticket · top 5 eligible
      </div>
    </div>
  );
}
