import Link from "next/link";
import { Bullets, LegalPage } from "@/components/legal-page";
import { LEGAL, whoWeAre } from "@/lib/legal";
import { formatMoney } from "@/lib/format";
import { TRUST_FEE_MINOR } from "@/lib/domain/constants";
import { CARD_PROCESSING_FEE_BPS, DISCOVERY_COMMISSION_BPS } from "@/lib/domain/settlement";
import { DISPUTE_WINDOW_HOURS } from "@/lib/domain/completion";
import { HOLD_LEAD_DAYS } from "@/lib/domain/payment-rules";
import { FREE_CANCELLATION_HOURS, LATE_CANCELLATION_FEE_BPS, NO_SHOW_WAIT_MINUTES } from "@/lib/domain/cancellation";

export const metadata = { title: "Terms of use", description: "The terms for booking and offering beauty services on GLAMNET." };

const pct = (bps: number) => `${bps / 100}%`;

/**
 * Terms of use. The numbers (fees, commission, windows) are read from the
 * same constants the booking engine uses, so the terms can't drift from what
 * the app actually does.
 */
export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of use"
      intro={
        <>
          <p>
            {whoWeAre()} These terms apply when you use GLAMNET, whether you&rsquo;re booking a beauty service
            (&ldquo;customer&rdquo;) or offering one (&ldquo;pro&rdquo;). By creating an account or making a booking
            you agree to them. They sit alongside our <Link href="/privacy" className="font-semibold text-accent-700 hover:underline">privacy policy</Link> and{" "}
            <Link href="/cancellations" className="font-semibold text-accent-700 hover:underline">cancellation and refund policy</Link>.
          </p>
          <p>Nothing in these terms affects your statutory rights as a consumer.</p>
        </>
      }
      sections={[
        {
          heading: "What GLAMNET is",
          body: (
            <>
              <p>
                GLAMNET is a marketplace. We help you find independent beauty pros, book them, and pay safely. The
                beauty service itself is provided by the pro, who is independent of us and responsible for their work.
              </p>
              <p>
                When you book, your contract for the service is with the pro. We collect payment on the pro&rsquo;s
                behalf as their commercial agent, which means that once you&rsquo;ve paid us, you&rsquo;ve paid the pro.
              </p>
            </>
          ),
        },
        {
          heading: "Your account",
          body: (
            <Bullets
              items={[
                "You must be 18 or over to have an account.",
                "Give accurate details and keep them up to date, including your phone number so your pro can reach you on the day.",
                "Keep your sign-in secure. You're responsible for bookings made from your account.",
                "We may suspend or close an account that breaks these terms, puts anyone at risk, or is used for fraud.",
              ]}
            />
          ),
        },
        {
          heading: "Prices",
          body: (
            <>
              <p>
                The price you see before you confirm is the full price. It is made up of the pro&rsquo;s price for each
                service, any travel fee for home visits, and a {formatMoney(TRUST_FEE_MINOR)} trust fee per booking,
                less any promo code.
              </p>
              <p>
                Bookings made at short notice (inside the emergency window shown on the booking screen) carry an
                emergency rate. It is always shown, itemised, before you confirm, and never added afterwards.
              </p>
            </>
          ),
        },
        {
          heading: "Paying: card holds and the checkout PIN",
          body: (
            <Bullets
              items={[
                <>When you book, we place a hold on your card for the total. A hold reserves the money; nothing is taken yet.</>,
                <>
                  For appointments more than {HOLD_LEAD_DAYS} days away, we save your card securely with our payment provider,
                  Stripe, and place the hold {HOLD_LEAD_DAYS} days before. If that hold fails we&rsquo;ll ask you to update
                  your card; if we still can&rsquo;t secure payment a day before, the booking is cancelled.
                </>,
                <>
                  When your appointment is finished, you&rsquo;ll see a 4-digit checkout PIN. Giving it to your pro confirms
                  the service was carried out, and releases payment. Please only give it once you&rsquo;re happy.
                </>,
                <>Card details are handled by Stripe and never stored by GLAMNET.</>,
              ]}
            />
          ),
        },
        {
          heading: "If something goes wrong",
          body: (
            <>
              <p>
                You can raise a problem from your booking page before giving your PIN, or within {DISPUTE_WINDOW_HOURS}{" "}
                hours after. We review the booking, the photos the pro takes of the finished work, and what both of you
                tell us, and decide fairly. That can mean a full or partial refund.
              </p>
              <p>
                After {DISPUTE_WINDOW_HOURS} hours the booking can no longer be disputed through GLAMNET. This
                doesn&rsquo;t affect your rights under the Consumer Rights Act 2015: services must be carried out with
                reasonable care and skill.
              </p>
            </>
          ),
        },
        {
          heading: "Cancellations",
          body: (
            <p>
              See our <Link href="/cancellations" className="font-semibold text-accent-700 hover:underline">cancellation and refund policy</Link>.
              In short: cancelling is free up to {FREE_CANCELLATION_HOURS} hours before your appointment. After that
              it costs {pct(LATE_CANCELLATION_FEE_BPS)} of the service price, and a missed appointment is charged at the
              full service price (plus travel for a home visit). Fees come out of the amount already held on your card,
              are shown before you confirm, and can be disputed for {DISPUTE_WINDOW_HOURS} hours. If your pro cancels,
              nothing is charged.
            </p>
          ),
        },
        {
          heading: "For pros",
          body: (
            <Bullets
              items={[
                "Every pro is checked before going live. You must hold the insurance, licences and qualifications your services need, and keep them current.",
                "You set your own prices and availability, and must honour bookings you accept. If you have to cancel, the client pays nothing, and you must give them a reason. Cancelling repeatedly, or at short notice, can lead to removal.",
                <>
                  If a client cancels within {FREE_CANCELLATION_HOURS} hours or doesn&rsquo;t turn up, you receive your share of the
                  cancellation fee, as set out in the cancellation policy. Only mark a client as a no-show if you were there
                  (at their door, for a home visit) and waited at least {NO_SHOW_WAIT_MINUTES} minutes; a no-show you mark
                  wrongly will be refunded to the client and may lead to removal.
                </>,
                <>
                  Commission: for a new client who finds you through GLAMNET, we keep {pct(DISCOVERY_COMMISSION_BPS)} of the
                  service value (and cover the card fees). Bookings through your own GLAMNET link, and repeat clients, carry
                  no commission — just a {pct(CARD_PROCESSING_FEE_BPS)} card processing fee. Your payout and any commission
                  are shown on every booking.
                </>,
                "Payouts go to your bank through Stripe once the client's PIN is entered. You must complete Stripe's identity checks to be paid.",
                "Take the three finished-work photos at checkout. They are how disputes are judged.",
                `If a dispute is upheld, we may reduce or reverse your payout for that booking, up to what you were paid for it.`,
                "Don't ask clients who booked through GLAMNET to pay you outside it for that booking.",
              ]}
            />
          ),
        },
        {
          heading: "Behaving well",
          body: (
            <Bullets
              items={[
                "Treat each other with respect. We don't tolerate harassment, discrimination or unsafe behaviour.",
                "Don't use GLAMNET to break the law, mislead anyone, or get around our fees.",
                "Reviews must be honest and about a real booking.",
              ]}
            />
          ),
        },
        {
          heading: "Our responsibility",
          body: (
            <>
              <p>
                We run GLAMNET with reasonable care and skill, check pros before they go live, and handle payments
                securely. Pros are responsible for the services they provide.
              </p>
              <p>
                We&rsquo;re not responsible for losses we couldn&rsquo;t reasonably foresee, or for business losses. We
                don&rsquo;t exclude liability where it would be unlawful to, including for death or personal injury
                caused by our negligence, or for fraud.
              </p>
            </>
          ),
        },
        {
          heading: "Changes and law",
          body: (
            <>
              <p>
                We may update these terms. We&rsquo;ll change the date at the top and, for significant changes, tell
                you by email or in the app. Bookings already made carry on under the terms in force when you made them.
              </p>
              <p>
                These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland,
                you can also bring proceedings there. Contact us first at {LEGAL.contactEmail} — most things can be
                sorted quickly.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
