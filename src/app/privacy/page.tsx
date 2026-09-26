import Link from "next/link";
import { Bullets, LegalPage } from "@/components/legal-page";
import { LEGAL, whoWeAre } from "@/lib/legal";

export const metadata = { title: "Privacy policy", description: "What GLAMNET collects, why, who it's shared with, and your rights." };

/** Privacy policy (UK GDPR and the Data Protection Act 2018). */
export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy policy"
      intro={
        <>
          <p>
            {whoWeAre()} We are the data controller for the personal information described here.
            {LEGAL.icoNumber ? ` We're registered with the Information Commissioner's Office (${LEGAL.icoNumber}).` : ""}
          </p>
          <p>We collect only what we need to run bookings safely, and we never sell your data.</p>
        </>
      }
      sections={[
        {
          heading: "What we collect",
          body: (
            <Bullets
              items={[
                <><strong>Account details:</strong> your name, email address, phone number and, if you add one, a profile photo.</>,
                <><strong>Location:</strong> the postcode or area you search from, and for home visits the address you give. Your full address is only shown to your pro once they&rsquo;re on their way.</>,
                <><strong>Bookings:</strong> the services, times, prices, notes and any reference photo you add; the booking&rsquo;s history; ratings and reviews; and anything you tell us in a dispute.</>,
                <><strong>Completion photos:</strong> the three photos your pro takes of the finished work, kept as the record for any dispute.</>,
                <><strong>Payments:</strong> handled by Stripe. We keep Stripe&rsquo;s references and the amounts, never your full card number.</>,
                <><strong>For pros:</strong> business details, services and prices, portfolio photos, working area, insurance and licence documents for our checks, and the payout details you give Stripe.</>,
                <><strong>Notifications:</strong> if you turn on notifications, a technical address for your device from your browser&rsquo;s push service.</>,
                <><strong>Usage analytics (only if you accept analytics cookies):</strong> the pages you visit, searches, the steps of a booking you reach, your device and browser type and approximate location (town or region), collected through Google Analytics and linked to an internal account number if you&rsquo;re signed in.</>,
                <><strong>Technical data:</strong> basic logs (like IP address and browser type) that our hosting keeps for security and troubleshooting.</>,
              ]}
            />
          ),
        },
        {
          heading: "Why we use it, and our legal basis",
          body: (
            <Bullets
              items={[
                <><strong>To provide bookings</strong> — matching you with pros, taking payment, releasing it on your PIN, and handling problems. Basis: our contract with you.</>,
                <><strong>To keep GLAMNET safe</strong> — checking pros, preventing fraud, and resolving disputes. Basis: our legitimate interests in a trustworthy marketplace, and our contract with you.</>,
                <><strong>To keep records</strong> the law requires, such as financial records. Basis: legal obligation.</>,
                <><strong>To understand and improve GLAMNET</strong> — measuring which pages, searches and booking steps work. Basis: your consent, given on the cookie banner and withdrawable any time from &ldquo;Cookie settings&rdquo;.</>,
                <><strong>To send notifications</strong> to your device. Basis: your consent, which you can withdraw at any time by turning them off.</>,
                <><strong>To tell you about GLAMNET</strong> — occasional updates and offers. Basis: legitimate interests for people who have used GLAMNET, or your consent. You can opt out any time with the unsubscribe link in any of these emails, from your account page, or by emailing {LEGAL.contactEmail}. Opting out doesn&rsquo;t affect emails about your bookings.</>,
              ]}
            />
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <p>
                <strong>Your pro</strong> sees what they need for the booking: your name, the services, your notes and
                reference photo, your phone number, and your address once they&rsquo;re on their way.{" "}
                <strong>Customers</strong> see a pro&rsquo;s public storefront, and the pro&rsquo;s name on bookings.
              </p>
              <p>We use trusted providers to run GLAMNET, who only process data on our instructions:</p>
              <Bullets
                items={[
                  "Stripe — payments, card holds and pro payouts",
                  "Supabase — sign-in and our database",
                  "Vercel — hosting the website and app",
                  "Resend — sending emails",
                  "ImageKit — storing and resizing photos",
                  "postcodes.io — looking up UK postcodes",
                  "OpenStreetMap — map tiles on the directory",
                  "Google Analytics — usage analytics, only if you accept analytics cookies",
                  "Your browser's push service (for example Google or Apple) — delivering notifications, if you turn them on",
                ]}
              />
              <p>
                We may also share information where the law requires it, or to protect someone&rsquo;s safety.
              </p>
            </>
          ),
        },
        {
          heading: "Where your data goes",
          body: (
            <p>
              Some of these providers process data outside the UK, for example in the United States. Where they do, we
              rely on safeguards approved under UK law, such as the International Data Transfer Addendum or the UK–US
              data bridge.
            </p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <Bullets
              items={[
                "Your account, for as long as you have one.",
                "Bookings and payment records, for six years after the booking, as tax and accounting law requires.",
                "Completion photos and dispute records, with the booking they belong to.",
                "Pros' verification documents, while they're on GLAMNET and for a year after, in case of a complaint.",
                "Device notification addresses, until you turn notifications off or the address stops working.",
                "Analytics data, for 14 months, after which Google deletes it.",
              ]}
            />
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <p>
                You can ask us for a copy of your data, to correct it, to delete it, to restrict or object to how we use
                it, or to have it sent to you or someone else in a portable format. Email {LEGAL.contactEmail} and
                we&rsquo;ll reply within a month. Some records (like payment records) we must keep even if you ask us
                to delete your account.
              </p>
              <p>
                If you&rsquo;re unhappy with how we handle your data, you can complain to the Information
                Commissioner&rsquo;s Office at ico.org.uk — though we&rsquo;d appreciate the chance to put it right
                first.
              </p>
            </>
          ),
        },
        {
          heading: "Cookies",
          body: (
            <p>
              We use the cookies GLAMNET needs to work, such as keeping you signed in, and — only if you accept them —
              Google Analytics cookies. You can change your choice at any time. See our{" "}
              <Link href="/cookies" className="font-semibold text-accent-700 hover:underline">cookie policy</Link>.
            </p>
          ),
        },
        {
          heading: "Changes",
          body: <p>If we change this policy, we&rsquo;ll update the date at the top, and tell you if the change matters.</p>,
        },
      ]}
    />
  );
}
