import Link from "next/link";
import {
  BOOKING_GRACE_MINUTES,
  freeCancellationEndsAt,
  LATE_CANCELLATION_FEE_BPS,
} from "@/lib/domain/cancellation";

const ukTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Europe/London",
});

/**
 * The cancellation policy, stated at checkout before the customer commits —
 * with the actual deadline for this appointment, not just "24 hours".
 * A fee the customer wasn't clearly told about is one they can fairly refuse.
 */
export function CancellationTerms({ appointmentStartAt, now = new Date() }: { appointmentStartAt: string | Date; now?: Date }) {
  const deadline = freeCancellationEndsAt(new Date(appointmentStartAt));
  const insideWindow = deadline.getTime() <= now.getTime();
  const late = `${LATE_CANCELLATION_FEE_BPS / 100}%`;

  return (
    <p className="rounded-glam-sm bg-sunken p-3 text-xs leading-relaxed text-ink-muted">
      <span className="font-semibold text-ink">Cancellation: </span>
      {insideWindow ? (
        <>
          free for {BOOKING_GRACE_MINUTES} minutes after booking. As your appointment is less than a day away, after
          that cancelling costs {late} of the service price.
        </>
      ) : (
        <>
          free until <span className="font-semibold text-ink">{ukTime.format(deadline).replace(/ /g, " ")}</span>.
          After that, cancelling costs {late} of the service price.
        </>
      )}{" "}
      A missed appointment is charged in full.{" "}
      <Link href="/cancellations" className="underline underline-offset-2 hover:text-ink">
        Policy
      </Link>
    </p>
  );
}
