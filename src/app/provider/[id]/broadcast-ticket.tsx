"use client";

import { useEffect, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import { BookingTypeTag, Button, Card, DurationStrip } from "@/components/ui";
import { formatDayTime, formatDuration, formatMoney } from "@/lib/format";
import {
  BROADCAST_ACCEPTANCE_WINDOW_MINUTES,
  TRANSITION_BUFFER_MINUTES,
} from "@/lib/domain/constants";

export interface BroadcastRequest {
  bookingId: string;
  bookingType: string;
  appointmentStartAt: string;
  noticePeriodMinutes: number;
  noticeLabel: string;
  services: string[];
  serviceDurationMinutes: number;
  reservedDurationMinutes: number;
  sector: string;
  hubName: string;
  earningsMinor: number;
  emergencyEarningsMinor: number;
  acceptanceExpiresAt: string;
}

/**
 * The vendor broadcast ticket (§P-02).
 *
 * The field order is fixed, because a vendor decides on this in seconds and
 * always in the same order: what kind of job and how long they have to answer,
 * when it is and how much notice that is, what the work is, how long it blocks,
 * where, what it pays, and only then the button. The tone is blunt and factual
 * throughout — no persuasion, no exclamation marks.
 *
 * The address is deliberately absent. At broadcast stage a vendor gets the
 * sector and nothing more; the street only appears once the booking reaches
 * Address Unlocked.
 */
export function BroadcastTicket({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: BroadcastRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isEmergency = request.bookingType === "EMERGENCY";
  // Declining can't be undone, so it takes two taps: the first arms it for a
  // few seconds, the second sends it.
  const [confirmDecline, setConfirmDecline] = useState(false);
  useEffect(() => {
    if (!confirmDecline) return;
    const timer = setTimeout(() => setConfirmDecline(false), 4_000);
    return () => clearTimeout(timer);
  }, [confirmDecline]);
  const secondsLeft = useCountdown(request.acceptanceExpiresAt);
  const expired = secondsLeft <= 0;
  const windowSeconds = BROADCAST_ACCEPTANCE_WINDOW_MINUTES * 60;
  const remaining = Math.min(1, Math.max(0, secondsLeft / windowSeconds));

  return (
    <Card
      className={`overflow-hidden ${
        isEmergency ? "border-l-4 border-l-emergency" : ""
      }`}
    >
      {/* 1 — what this is, and how long is left to answer. */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
          isEmergency ? "bg-emergency-soft" : "bg-sunken"
        }`}
      >
        {isEmergency ? (
          <p className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-emergency-ink">
            <span
              aria-hidden
              className="breathe-emergency flex h-5 w-5 items-center justify-center rounded-full bg-emergency text-on-emergency"
            >
              <Lightning size={12} weight="fill" />
            </span>
            Emergency booking
          </p>
        ) : (
          <BookingTypeTag bookingType={request.bookingType} />
        )}

        <span
          data-numeric
          aria-live="polite"
          className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-sm font-bold ${
            isEmergency
              ? "bg-emergency text-on-emergency"
              : "bg-surface text-ink ring-1 ring-line"
          }`}
        >
          {expired ? "expired" : `${formatCountdown(secondsLeft)} left`}
        </span>
      </div>

      <div className="p-4">
        {/* 2 — when, and how much notice that is. */}
        <p className="font-display text-lg font-semibold text-ink">
          {formatDayTime(request.appointmentStartAt)}
          <span className="text-ink-muted"> · </span>
          <span
            data-numeric
            className={isEmergency ? "text-emergency-ink" : "text-ink-muted"}
          >
            notice {request.noticeLabel}
          </span>
        </p>

        {/* 3 — the work itself. */}
        <p className="mt-2 text-[15px] text-ink">
          {request.services.join(" + ")}
        </p>

        {/* 4 — what it actually blocks out, transition included. */}
        <DurationStrip
          className="mt-3"
          serviceLabel={formatDuration(request.serviceDurationMinutes)}
          transitionMinutes={TRANSITION_BUFFER_MINUTES}
          blockLabel={formatDuration(request.reservedDurationMinutes)}
        />

        {/* 5 and 6 — sector only, and the money. */}
        <dl className="mt-3 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Sector
            </dt>
            <dd className="mt-0.5 text-[15px] font-medium text-ink">
              {request.sector}
            </dd>
          </div>
          <div className="text-right">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              You earn
            </dt>
            <dd
              data-numeric
              className="mt-0.5 font-display text-xl font-bold text-ink"
            >
              {formatMoney(request.earningsMinor)}
            </dd>
            {request.emergencyEarningsMinor > 0 ? (
              <dd
                data-numeric
                className="text-xs font-semibold text-emergency-ink"
              >
                incl. {formatMoney(request.emergencyEarningsMinor)} surge
              </dd>
            ) : null}
          </div>
        </dl>

        {/* 7 — the countdown, drawn. */}
        <div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-sunken"
          role="presentation"
        >
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              isEmergency ? "bg-emergency" : "bg-brand-700"
            }`}
            style={{ width: `${remaining * 100}%` }}
          />
        </div>

        {/* 8 — the decision. Accept is the wider, stronger button. */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button
            variant="secondary"
            onClick={() => (confirmDecline ? onDecline() : setConfirmDecline(true))}
            disabled={busy || expired}
            className="w-full"
          >
            {confirmDecline ? "Confirm?" : "Decline"}
          </Button>
          <Button
            variant={isEmergency ? "emergency" : "primary"}
            onClick={onAccept}
            disabled={busy || expired}
            className="w-full uppercase tracking-wider"
          >
            {busy
              ? "Sending…"
              : expired
                ? "Expired"
                : isEmergency
                  ? "Accept emergency"
                  : "Accept"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Seconds left until `expiresAt`, ticking once a second.
 *
 * The server sends an absolute deadline, so the only state here is the current
 * time: nothing has to be reset when the request list refreshes, and the
 * countdown stays honest however long the page has been open.
 */
function useCountdown(expiresAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
