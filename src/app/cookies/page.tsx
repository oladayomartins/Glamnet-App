import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Cookie policy", description: "The cookies and browser storage GLAMNET uses." };

/**
 * Cookie policy. GLAMNET sets only strictly necessary cookies and storage, so
 * under PECR no consent banner is needed. If analytics or advertising are ever
 * added, that changes: a consent banner has to come first.
 */
export default function CookiesPage() {
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
          Cookies are small files a website stores in your browser. GLAMNET only uses the ones it needs to work. We
          don&rsquo;t use advertising or tracking cookies, and we don&rsquo;t use analytics that follow you around the
          web — so there&rsquo;s nothing to accept or reject.
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
          heading: "Why there's no cookie banner",
          body: (
            <p>
              UK law (the Privacy and Electronic Communications Regulations) lets websites use cookies that are strictly
              necessary for a service you&rsquo;ve asked for without asking first. Everything above falls into that
              group. If we ever add anything else, we&rsquo;ll ask for your consent before setting it.
            </p>
          ),
        },
        {
          heading: "Controlling cookies",
          body: (
            <p>
              You can clear or block cookies in your browser settings. If you block the ones above, you won&rsquo;t be
              able to stay signed in or pay for bookings.
            </p>
          ),
        },
      ]}
    />
  );
}
