"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightning } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import { formatDayTime, formatMoney } from "@/lib/format";
import type { ProviderToday } from "@/lib/server/provider-today";

/**
 * The provider's today strip (§P-01): the next job with a countdown, what
 * today pays, and their acceptance rate.
 *
 * Blunt and factual, as the whole provider app is. No encouragement, no
 * congratulation — a provider opening this at 07:00 wants three numbers.
 */
export function TodayStrip({
  providerId,
  today,
}: {
  providerId: string;
  today: ProviderToday;
}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      <NextJob job={today.nextJob} />

      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Today
        </p>
        <p
          data-numeric
          className="mt-1 font-display text-2xl font-bold text-ink"
        >
          {formatMoney(today.todayEarningsMinor)}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {today.todayJobCount} {today.todayJobCount === 1 ? "job" : "jobs"}{" "}
          booked
        </p>
      </Card>

      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Acceptance rate
        </p>
        <p
          data-numeric
          className="mt-1 font-display text-2xl font-bold text-ink"
        >
          {/* Never 0% for someone who has simply never been broadcast to. */}
          {today.acceptanceRate === null ? "—" : `${today.acceptanceRate}%`}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {today.acceptanceRate === null
            ? "No requests yet"
            : "Of requests sent to you"}
        </p>
      </Card>

      <AvailabilityToggle
        providerId={providerId}
        initial={today.isAcceptingWork}
      />
    </div>
  );
}

function NextJob({ job }: { job: ProviderToday["nextJob"] }) {
  const countdown = useCountdown(job?.startAt ?? null);
  const isEmergency = job?.bookingType === "EMERGENCY";

  if (!job) {
    return (
      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Next job
        </p>
        <p className="mt-1 font-display text-2xl font-bold text-ink">None</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Nothing booked ahead of you
        </p>
      </Card>
    );
  }

  return (
    <Card
      className={`p-4 ${isEmergency ? "border-l-4 border-l-emergency" : ""}`}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        Next job
        {isEmergency ? (
          <span className="flex items-center gap-0.5 font-bold text-emergency-ink">
            <Lightning size={10} weight="fill" aria-hidden />
            Emergency
          </span>
        ) : null}
      </p>
      <p data-numeric className="mt-1 font-display text-2xl font-bold text-ink">
        {countdown}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {formatDayTime(job.startAt)} · {job.sector}
      </p>
      <Link
        href={`/bookings/${job.bookingId}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
      >
        {job.customerName}
        <ArrowRight size={12} weight="light" aria-hidden />
      </Link>
    </Card>
  );
}

/**
 * The availability switch.
 *
 * The copy says exactly what it does — turning work off stops new requests,
 * and does not touch anything already accepted — because a provider tapping
 * this before a hospital appointment needs to know their afternoon booking is
 * still theirs.
 */
function AvailabilityToggle({
  providerId,
  initial,
}: {
  providerId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !accepting;
    setBusy(true);
    setError(null);
    // Optimistic: the switch is the one control that must feel instant.
    setAccepting(next);
    try {
      const response = await fetch(`/api/providers/${providerId}/availability`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAcceptingWork: next }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Could not save that.");
      }
      router.refresh();
    } catch (cause) {
      setAccepting(!next);
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col justify-between p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Taking work
        </p>
        <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-ink">
          {accepting ? (
            <>
              <span
                aria-hidden
                className="breathe h-2.5 w-2.5 rounded-full bg-normal"
              />
              On
            </>
          ) : (
            "Off"
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {accepting
            ? "New requests reach you"
            : "No new requests. Accepted jobs are unaffected."}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={accepting}
        aria-label="Taking work"
        onClick={toggle}
        disabled={busy}
        className={`mt-3 inline-flex h-11 w-full items-center justify-between rounded-full px-1.5 text-sm font-semibold transition duration-[180ms] ease-glam disabled:opacity-50 ${
          accepting
            ? "bg-normal-soft text-normal-ink ring-1 ring-normal/25"
            : "bg-sunken text-ink-muted ring-1 ring-line"
        }`}
      >
        <span className="px-2">{accepting ? "Turn off" : "Turn on"}</span>
        <span
          aria-hidden
          className={`h-8 w-8 rounded-full transition duration-[180ms] ease-glam ${
            accepting ? "bg-normal" : "bg-line"
          }`}
        />
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

/** "in 4h 35m", ticking once a minute. */
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
