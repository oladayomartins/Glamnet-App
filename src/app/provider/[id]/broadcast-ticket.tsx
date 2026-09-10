"use client";

import { useEffect, useState } from "react";
import { BookingTypeTag, Button, Card } from "@/components/ui";
import { formatDayTime, formatDuration, formatMoney } from "@/lib/format";

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
 * The provider booking ticket (spec §6). Shows everything a provider needs to
 * judge short-notice work before accepting: the emergency tag, the appointment
 * time, the notice remaining, the services, the total duration, the sector,
 * their earnings, the surge component of those earnings, and the acceptance
 * countdown.
 */
export function BroadcastTicket({
  request,
  busy,
  onAccept,
}: {
  request: BroadcastRequest;
  busy: boolean;
  onAccept: () => void;
}) {
  const isEmergency = request.bookingType === "EMERGENCY";
  const secondsLeft = useCountdown(request.acceptanceExpiresAt);
  const expired = secondsLeft <= 0;

  return (
    <Card
      className={`p-4 ${isEmergency ? "border-l-4 border-l-emergency" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookingTypeTag bookingType={request.bookingType} />
          <p className="mt-2 font-display text-lg font-semibold text-ink">
            {formatDayTime(request.appointmentStartAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            You earn
          </p>
          <p className="font-display text-xl font-bold text-ink">
            {formatMoney(request.earningsMinor)}
          </p>
          {request.emergencyEarningsMinor > 0 ? (
            <p className="text-xs font-semibold text-emergency">
              incl. {formatMoney(request.emergencyEarningsMinor)} surge
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm sm:grid-cols-4">
        <Field label="Notice">
          <span className={isEmergency ? "font-semibold text-emergency" : ""}>
            {request.noticeLabel}
          </span>
        </Field>
        <Field label="Duration">
          {formatDuration(request.serviceDurationMinutes)}
        </Field>
        <Field label="Blocks">
          {formatDuration(request.reservedDurationMinutes)}
        </Field>
        <Field label="Sector">{request.sector}</Field>
      </dl>

      <p className="mt-3 text-sm text-ink">
        <span className="text-ink-muted">Services: </span>
        {request.services.join(" + ")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant={isEmergency ? "emergency" : "primary"}
          onClick={onAccept}
          disabled={busy || expired}
        >
          {busy
            ? "Accepting…"
            : expired
              ? "Request expired"
              : isEmergency
                ? "Accept emergency booking"
                : "Accept booking"}
        </Button>
        {!expired ? (
          <span className="text-xs text-ink-muted" aria-live="polite">
            {formatCountdown(secondsLeft)} left to respond
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
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
