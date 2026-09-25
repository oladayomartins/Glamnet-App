import Link from "next/link";
import { Bullets, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";
import { DISPUTE_WINDOW_HOURS } from "@/lib/domain/completion";
import { BROADCAST_ACCEPTANCE_WINDOW_MINUTES } from "@/lib/domain/constants";
import { UNSECURED_CANCEL_HOURS } from "@/lib/domain/payment-rules";

export const metadata = {
  title: "Cancellations & refunds",
  description: "What happens to your money if a GLAMNET booking is cancelled, or something goes wrong.",
};

/**
 * Cancellation and refund policy. Describes what the app actually does:
 * money is only ever held until the checkout PIN, so a cancellation before
 * then releases the hold rather than needing a refund.
 */
export default function CancellationsPage() {
  return (
    <LegalPage
      current="/cancellations"
      title="Cancellations & refunds"
      intro={
        <p>
          On GLAMNET your money is held, not taken, until you give your pro the checkout PIN at the end of the
          appointment. So if a booking is cancelled before then, there&rsquo;s nothing to refund: the hold on your card
          is simply released. We don&rsquo;t charge cancellation fees.
        </p>
      }
      sections={[
        {
          heading: "If you need to cancel",
          body: (
            <>
              <Bullets
                items={[
                  <>
                    <strong>Before a pro accepts</strong> a request, it lapses on its own if nobody accepts within{" "}
                    {BROADCAST_ACCEPTANCE_WINDOW_MINUTES} minutes, and the hold is released straight away.
                  </>,
                  <>
                    <strong>After it&rsquo;s confirmed, up until your pro sets off,</strong> contact your pro or email us
                    at {LEGAL.contactEmail} and we&rsquo;ll cancel it. The hold is released in full.
                  </>,
                  <>
                    <strong>Once your pro is on their way,</strong> please contact us. They&rsquo;ve set aside the time
                    and are travelling to you, so we&rsquo;ll look at what&rsquo;s fair to both of you.
                  </>,
                ]}
              />
              <p>
                Please give as much notice as you can — independent pros lose the whole slot when a booking is dropped.
              </p>
            </>
          ),
        },
        {
          heading: "If your pro cancels",
          body: (
            <p>
              The hold on your card is released in full, and you&rsquo;re free to book someone else straight away.
              Pros who cancel repeatedly can be removed from GLAMNET.
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
              care and skill. See our <Link href="/terms" className="font-semibold text-accent-700 hover:underline">terms of use</Link> for more.
            </p>
          ),
        },
      ]}
    />
  );
}
