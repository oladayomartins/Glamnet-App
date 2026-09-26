import Link from "next/link";
import { GlamNetPin } from "@/components/brand";
import { SITE_NAME } from "@/lib/site";
import { CookieSettingsButton } from "@/components/analytics";

/**
 * Site footer.
 *
 * Deliberately takes no data. It renders inside the root layout, which wraps
 * the statically prerendered 404 — so a database read here would force that
 * page to reach the database at build time, which is exactly what broke the
 * first production deploy. Browsing by service and area is real content on the
 * marketing page, where it is request-rendered and can be, rather than being
 * squeezed into furniture that has to work everywhere.
 */
export function SiteFooter({
  cookieSettings = false,
}: {
  /** Show "Cookie settings" — only when analytics is on for this deployment. */
  cookieSettings?: boolean;
}) {
  const columns = [
    {
      heading: "Customers",
      links: [
        { href: "/salons", label: "Find a pro near you" },
        { href: "/search", label: "Find a service" },
        { href: "/book", label: "Book a service" },
        { href: "/how-it-works", label: "How it works" },
      ],
    },
    {
      heading: "Vendors",
      links: [
        { href: "/become-a-vendor", label: "Become a vendor" },
        // The vendor column's sign-in goes straight to the vendor page: the
        // chooser exists for someone who arrived without saying who they are,
        // and this link has already said it.
        { href: "/sign-in/vendor", label: "Vendor sign in" },
      ],
    },
    {
      heading: "Bookings",
      links: [
        { href: "/account", label: "Your bookings" },
        { href: "/how-it-works", label: "Emergency bookings" },
      ],
    },
  ];

  return (
    /*
      An obsidian band in both themes, which is the brand's own ground rather
      than a borrowed one. Fixed rather than tokenised-and-flipping because
      the point of a dark footer is that it closes the page — one that turned
      pale in dark mode would stop doing that.
    */
    <footer data-site-footer className="safe-bottom mt-20 bg-obsidian text-on-obsidian">
      <div className="mx-auto w-full max-w-[var(--glam-page-max)] px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <GlamNetPin dotClassName="bg-obsidian" />
              <span className="text-lg font-bold tracking-[-0.03em]">
                {SITE_NAME}
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-on-obsidian-muted">
              The UK&rsquo;s marketplace for verified independent beauty
              pros — home salons, studios, chairs and mobile.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-obsidian-muted">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-on-obsidian transition duration-[180ms] hover:text-accent-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-on-obsidian-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. Emergency bookings are
            short-notice appointments; the surcharge is always shown before
            payment.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { href: "/terms", label: "Terms" },
              { href: "/privacy", label: "Privacy" },
              { href: "/cookies", label: "Cookies" },
              { href: "/cancellations", label: "Cancellations & refunds" },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="text-on-obsidian transition hover:text-accent-500">
                {link.label}
              </Link>
            ))}
            {cookieSettings ? (
              <CookieSettingsButton className="text-on-obsidian transition hover:text-accent-500" />
            ) : null}
          </nav>
        </div>
      </div>
    </footer>
  );
}
