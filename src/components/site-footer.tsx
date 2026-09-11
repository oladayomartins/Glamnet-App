import Link from "next/link";
import { GlamNetPin } from "@/components/brand";
import { SITE_NAME } from "@/lib/site";

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
export function SiteFooter() {
  const columns = [
    {
      heading: "Customers",
      links: [
        { href: "/search", label: "Find a service" },
        { href: "/book", label: "Book a service" },
        { href: "/how-it-works", label: "How it works" },
      ],
    },
    {
      heading: "Professionals",
      links: [
        { href: "/sign-up", label: "Become a provider" },
        { href: "/sign-in", label: "Sign in" },
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
    <footer className="safe-bottom mt-16 border-t border-line">
      <div className="mx-auto w-full max-w-[var(--glam-page-max)] px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <GlamNetPin />
              <span className="text-lg font-bold tracking-[-0.03em] text-ink">
                {SITE_NAME}
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Vetted hair and makeup professionals, booked to your door —
              including at short notice.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">
                {column.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. Emergency bookings are
            short-notice appointments; the surcharge is always shown before
            payment.
          </p>
        </div>
      </div>
    </footer>
  );
}
