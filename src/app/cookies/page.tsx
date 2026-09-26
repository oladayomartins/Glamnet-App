import { LegalPage } from "@/components/legal-page";
import { ConsentControls } from "@/components/analytics";

export const metadata = { title: "Cookie policy", description: "The cookies and browser storage GLAMNET uses." };

/**
 * Cookie policy. Strictly necessary cookies need no consent under PECR;
 * Google Analytics does, so it only loads after "Accept" on the banner (see
 * components/analytics.tsx), and this page is where that choice is changed.
 */
export default function CookiesPage() {
  const analyticsRows: Array<[string, string, string]> = [
    ["_ga (Google Analytics)", "Tells visits apart, so we can count how many people use GLAMNET.", "2 years"],
    ["_ga_<id> (Google Analytics)", "Keeps track of your current visit.", "2 years"],
    ["glamnet:analytics-consent (browser storage)", "Remembers your cookie choice, so we don't ask every time.", "Until you clear it"],
  ];
  const rows: Array<[string, string, string]> = [
    ["sb-… (Supabase)", "Keeps you signed in securely.", "Until you sign out, or the session expires"],
    ["__stripe_mid, __stripe_sid (Stripe)", "Set by Stripe on checkout pages to prevent card fraud.", "Up to a year / 30 minutes"],
    ["theme (browser storage)", "Remembers whether you chose light or dark mode.", "Until you clear it"],
  ];
  return (
    <LegalPage
      current="/cookies"
      title="Cookie policy"
      intro={
        <p>
          Cookies are small files a website stores in your browser. GLAMNET uses the ones it needs to work and, only if
          you say yes, Google Analytics cookies that help us understand how the site is used. We don&rsquo;t use
          advertising cookies, and our analytics are never used for advertising.
        </p>
      }
      sections={[
        {
          heading: "What we use",
          body: (
            <div className="overflow-x-auto rounded-glam-sm border border-line">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">What it&rsquo;s for</th>
                    <th className="px-3 py-2 font-medium">How long</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, purpose, duration]) => (
                    <tr key={name} className="border-b border-line/70 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-ink">{name}</td>
                      <td className="px-3 py-2 text-ink">{purpose}</td>
                      <td className="px-3 py-2 text-ink-muted">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          heading: "Analytics cookies (only with your consent)",
          body: (
            <div className="space-y-3">
              <p>
                If you accept, we use Google Analytics to see which pages are visited, how people find pros and where
                bookings get stuck. Google processes this for us. Google signals and ad personalisation are switched
                off, and one-time links (like sign-in and unsubscribe links) are stripped before anything is sent. If
                you&rsquo;re signed in we attach an internal account number — never your name or email — so we can
                understand journeys across devices.
              </p>
              <ConsentControls />
              <div className="overflow-x-auto rounded-glam-sm border border-line">
                <table className="w-full min-w-[520px] text-sm">
                  <tbody>
                    {analyticsRows.map(([name, purpose, duration]) => (
                      <tr key={name} className="border-b border-line/70 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-ink">{name}</td>
                        <td className="px-3 py-2 text-ink">{purpose}</td>
                        <td className="px-3 py-2 text-ink-muted">{duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          heading: "Why we ask",
          body: (
            <p>
              UK law (the Privacy and Electronic Communications Regulations) lets websites use cookies that are strictly
              necessary for a service you&rsquo;ve asked for without asking first. Analytics cookies aren&rsquo;t in
              that group, so nothing from Google Analytics loads until you choose &ldquo;Accept&rdquo;. You can change
              your mind at any time here, or with &ldquo;Cookie settings&rdquo; at the bottom of every page.
            </p>
          ),
        },
        {
          heading: "Controlling cookies",
          body: (
            <p>
              You can clear or block cookies in your browser settings. If you block the necessary ones, you won&rsquo;t
              be able to stay signed in or pay for bookings.
            </p>
          ),
        },
      ]}
    />
  );
}
