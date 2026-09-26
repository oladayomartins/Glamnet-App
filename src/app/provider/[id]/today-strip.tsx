"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Lightning } from "@phosphor-icons/react";
import { formatDayTime, formatMoney } from "@/lib/format";
import type { ProviderToday } from "@/lib/server/provider-today";

/**
 * The vendor's today strip (§P-01): the next job with a countdown, what
 * today and this week pay, and their acceptance rate.
 *
 * Four small tiles in a 2×2 grid, so on a phone they take one glance rather
 * than a screen of scrolling each. Blunt and factual, as the whole vendor app
 * is — a vendor opening this at 07:00 wants the numbers.
 */
export function TodayStrip({ today }: { today: ProviderToday }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Tile label="Today" value={formatMoney(today.todayEarningsMinor)} numeric>
        {jobs(today.todayJobCount)} booked
      </Tile>

      <NextJob job={today.nextJob} />

      <Tile label="This week" value={formatMoney(today.weekEarningsMinor)} numeric>
        {jobs(today.weekJobCount)} booked
      </Tile>

      <Tile
        label="Acceptance"
        // Never 0% for someone who has simply never been sent a request.
        value={today.acceptanceRate === null ? "—" : `${today.acceptanceRate}%`}
        numeric
      >
        {today.acceptanceRate === null ? "After your first request" : "Of requests sent to you"}
      </Tile>
    </div>
  );
}

function jobs(count: number): string {
  return `${count} ${count === 1 ? "job" : "jobs"}`;
}

function Tile({
  label,
  value,
  numeric,
  emergency,
  children,
}: {
  label: ReactNode;
  value: string;
  numeric?: boolean;
  emergency?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-glam border border-line bg-surface p-3.5 ${
        emergency ? "border-l-4 border-l-emergency" : ""
      }`}
    >
      <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">{label}</p>
      <p
        data-numeric={numeric ? true : undefined}
        className="mt-0.5 truncate font-display text-[22px] font-bold text-ink"
      >
        {value}
      </p>
      <div className="mt-0.5 text-xs text-ink-muted">{children}</div>
    </div>
  );
}

function NextJob({ job }: { job: ProviderToday["nextJob"] }) {
  const countdown = useCountdown(job?.startAt ?? null);

  if (!job) {
    return (
      <Tile label="Next job" value="None yet">
        Your diary is clear
      </Tile>
    );
  }

  const isEmergency = job.bookingType === "EMERGENCY";

  return (
    <Tile
      label={
        <>
          Next job
          {isEmergency ? (
            <span className="flex items-center gap-0.5 font-bold text-emergency-ink">
              <Lightning size={11} weight="fill" aria-hidden />
              Emergency
            </span>
          ) : null}
        </>
      }
      value={countdown}
      numeric
      emergency={isEmergency}
    >
      <p className="truncate">
        {formatDayTime(job.startAt)} · {job.sector}
      </p>
      <Link
        href={`/bookings/${job.bookingId}`}
        className="-mb-2 inline-flex min-h-11 max-w-full items-center gap-1 font-semibold text-brand-700 hover:underline"
      >
        <span className="truncate">{job.customerName}</span>
        <ArrowRight size={12} weight="light" aria-hidden className="shrink-0" />
      </Link>
    </Tile>
  );
}

/** "in 4h 35m", ticking twice a minute. */
function useCountdown(startAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!startAt) return "None";

  const minutes = Math.round((Date.parse(startAt) - now) / 60_000);
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}
