import Link from "next/link";
import { Bullets, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";
import { DISPUTE_WINDOW_HOURS } from "@/lib/domain/completion";
import { BROADCAST_ACCEPTANCE_WINDOW_MINUTES } from "@/lib/domain/constants";
import { UNSECURED_CANCEL_HOURS } from "@/lib/domain/payment-rules";
import {
  BOOKING_GRACE_MINUTES,
  FREE_CANCELLATION_HOURS,
  LATE_CANCELLATION_FEE_BPS,
  NO_SHOW_WAIT_MINUTES,
} from "@/lib/domain/cancellation";

const late = `${LATE_CANCELLATION_FEE_BPS / 100}%`;

export const metadata = {
  title: "Cancellations & refunds",
  description: "When you can cancel a GLAMNET booking for free, what late cancellations and missed appointments cost, and how refunds work.",
};

/**
 * Cancellation and refund policy. Describes what the app actually does, with
 * the numbers read from the same constants the cancel endpoint charges by:
 * money is only held until the checkout PIN, so a free cancellation releases
 * the hold, and a fee is taken from it without touching the rest.
 */
export default function CancellationsPage() {
  return (
    <LegalPage
      current="/cancellations"
      title="Cancellations & refunds"
      intro={
        <>
          <p>
            On GLAMNET your money is held, not taken, until you give your pro the checkout PIN at the end of the
            appointment. Cancel in good time and the hold on your card is simply released.
          </p>
          <p>
            Our pros are independent, and a slot cancelled at the last minute is one they usually can&rsquo;t fill. So,
            like most UK salons, we ask for {FREE_CANCELLATION_HOURS} hours&rsquo; notice. The fees below are set to
            cover what a pro typically loses — not to penalise anyone — and you&rsquo;ll always see the exact cost before
            you cancel.
          </p>
        </>
      }
      sections={[
        {
          heading: "If you need to cancel",
          body: (
            <>
              <p>Cancel from your booking page at any time. What it costs depends on when:</p>
              <Bullets
                items={[
                  <>
                    <strong>Before a pro accepts</strong> — free. A request also lapses on its own if nobody accepts
                    within {BROADCAST_ACCEPTANCE_WINDOW_MINUTES} minutes, and the hold is released straight away.
                  </>,
                  <>
                    <strong>More than {FREE_CANCELLATION_HOURS} hours before your appointment</strong> — free. The hold
                    on your card is released in full.
                  </>,
                  <>
                    <strong>Within {BOOKING_GRACE_MINUTES} minutes of booking</strong> — free, even for an appointment
                    less than a day away, as long as your pro hasn&rsquo;t set off.
                  </>,
                  <>
                    <strong>Less than {FREE_CANCELLATION_HOURS} hours before</strong> — {late} of the service price.
                    The trust fee, any tip and any travel fee aren&rsquo;t charged, and the rest of the hold is released.
                  </>,
                  <>
                    <strong>Once your pro is on their way, or after the start time</strong> — this counts as a missed
                    appointment (below). Once your pro has arrived, please contact us at {LEGAL.contactEmail}.
                  </>,
                ]}
              />
              <p>
                We send you a reminder the day before your free cancellation ends, and your booking page always shows the
                exact deadline.
              </p>
            </>
          ),
        },
        {
          heading: "Missed appointments",
          body: (
            <>
              <p>
                If you&rsquo;re not there and your pro can&rsquo;t reach you, they can mark the appointment as missed{" "}
                {NO_SHOW_WAIT_MINUTES} minutes after the start time (or after they arrived, if later). A missed
                appointment is charged at the full service price, plus the travel fee for a home visit — the time and the
                journey your pro gave up. The trust fee and any tip aren&rsquo;t charged.
              </p>
              <p>
                If you were there, or something outside your control stopped you, tell us from your booking page within{" "}
                {DISPUTE_WINDOW_HOURS} hours. We check the pro&rsquo;s arrival time and what you both tell us, and refund
                the fee if it wasn&rsquo;t fair.
              </p>
            </>
          ),
        },
        {
          heading: "Where the fee goes",
          body: (
            <p>
              A cancellation or missed-appointment fee goes to your pro, less the same commission and card fees as a
              completed booking. It is taken from the amount already held on your card — never more than that.
            </p>
          ),
        },
        {
          heading: "If your pro cancels",
          body: (
            <p>
              It&rsquo;s free for you, whenever it happens: the hold on your card is released in full, and you&rsquo;re
              free to book someone else straight away. Pros must give a reason, which you&rsquo;ll see. We review every
              cancellation a pro makes within {FREE_CANCELLATION_HOURS} hours, and pros who cancel repeatedly can be
              removed from GLAMNET.
            </p>
          ),
        },
        {
          heading: "If we can't secure your card",
          body: (
            <p>
              For appointments booked well ahead, we hold your card a few days before. If that fails, we&rsquo;ll ask you
              to update your card. If payment still isn&rsquo;t secured {UNSECURED_CANCEL_HOURS} hours before the
              appointment, the booking is cancelled so your pro isn&rsquo;t left travelling to an unpaid job. Nothing is
              charged.
            </p>
          ),
        },
        {
          heading: "When something goes wrong at the appointment",
          body: (
            <>
              <p>
                Don&rsquo;t give your PIN if you&rsquo;re not happy. Raise a problem from your booking page instead — you
                can do this before giving the PIN, or up to {DISPUTE_WINDOW_HOURS} hours after.
              </p>
              <p>
                We&rsquo;ll look at the booking, the photos your pro took of the finished work, and what you both tell
                us. Depending on what happened, we may refund you in full or in part. If your payment hadn&rsquo;t been
                taken yet, we only take what&rsquo;s fair and release the rest.
              </p>
            </>
          ),
        },
        {
          heading: "How refunds reach you",
          body: (
            <Bullets
              items={[
                "A released hold usually disappears from your statement within a few days, depending on your bank.",
                "Refunds go back to the card you paid with, usually within 5–10 working days.",
                <>
                  If you&rsquo;re thinking of asking your bank to reverse a payment, please talk to us first at{" "}
                  {LEGAL.contactEmail} — it&rsquo;s usually quicker.
                </>,
              ]}
            />
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              Beauty services booked for a specific date aren&rsquo;t covered by the usual 14-day cooling-off period.
              Your rights under the Consumer Rights Act 2015 still apply: services must be carried out with reasonable
              care and skill, and nothing in this policy takes those rights away. If you think a fee was unfair, tell us
              and we&rsquo;ll look at it. See our <Link href="/terms" className="font-semibold text-accent-700 hover:underline">terms of use</Link> for more.
            </p>
          ),
        },
      ]}
    />
  );
}
