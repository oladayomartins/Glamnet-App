import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  JetBrains_Mono,
} from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GlamNetPin } from "@/components/brand";
import { getSessionUser } from "@/lib/auth/session";
import { SiteFooter } from "@/components/site-footer";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  isProductionSite,
  siteUrl,
} from "@/lib/site";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { OfflineNotice } from "@/components/offline-notice";

/**
 * The brand families, paired with the token layer in globals.css.
 *
 * Two families only, no third font ever (brand guide §03): Instrument Sans for
 * everything human, JetBrains Mono for everything exact — ids, timers, sector
 * codes, money that ticks. There is deliberately no display serif: the display
 * voice comes from weight and tight tracking, not a third typeface.
 */
const brandSans = Instrument_Sans({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const brandDisplay = Bricolage_Grotesque({
  variable: "--font-brand-display",
  subsets: ["latin"],
  // Variable axis rather than fixed cuts: headings sit at 800 and the wordmark
  // at 700, and shipping one file for both is lighter than two.
  weight: ["700", "800"],
  display: "swap",
});

const brandMono = JetBrains_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  // Without a base, Open Graph images and canonical links are emitted as
  // relative paths, which crawlers and social scrapers discard — so a shared
  // link would preview as a bare URL.
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, statusBarStyle: "default", title: SITE_NAME },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  // Preview deployments must never be indexed alongside the real site.
  robots: isProductionSite()
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export const viewport: Viewport = {
  // Obsidian in dark, warm paper in light — the browser chrome follows the
  // active mode rather than pinning one brand colour.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#100f13" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Public navigation. Role-specific links are added from the session below. */
const NAV = [
  { href: "/search", label: "Find a service" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/sign-up", label: "Become a provider" },
];

/**
 * The root layout must stay free of data access.
 *
 * It wraps every route, including the statically prerendered 404 — so a
 * database read here forces that page to reach the database at build time,
 * and the whole build fails wherever one is not available. The emergency
 * threshold is stated with its live value on the screens where it actually
 * matters (the home page and checkout), which load it themselves.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The only data this layout reads is the viewer's own session, which is
  // request-scoped and cannot be prerendered — so it does not reintroduce the
  // build-time database dependency that the 404 page was tripping over.
  const user = await getSessionUser();

  const roleLinks = [
    ...(user?.role === "PROVIDER"
      ? [{ href: "/account", label: "My work" }]
      : []),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <html
      lang="en-GB"
      // next-themes writes data-theme here before paint, which React would
      // otherwise flag as a hydration mismatch.
      suppressHydrationWarning
      className={`${brandSans.variable} ${brandDisplay.variable} ${brandMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <ThemeProvider>
          <OfflineNotice />

          <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[var(--glam-page-max)] items-center justify-between gap-4 px-4 py-3">
              <Link
                href="/"
                aria-label="GLAMNET home"
                className="tap-44 flex items-center gap-2.5"
              >
                <GlamNetPin />
                {/* The wordmark is set tight, not letterspaced — the mark is
                    never re-lettered. [§01] */}
                <span className="text-xl font-bold tracking-[-0.03em] text-ink">
                  GLAMNET
                </span>
              </Link>
              <nav className="flex items-center gap-1" aria-label="Main">
                {[...(user ? NAV.filter((i) => i.href !== "/sign-up") : NAV), ...roleLinks].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="tap-44 hidden rounded-glam-sm px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-brand-50 hover:text-brand-700 sm:inline-flex"
                  >
                    {item.label}
                  </Link>
                ))}

                {user ? (
                  <Link
                    href="/account"
                    className="tap-44 rounded-glam-sm px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    Account
                  </Link>
                ) : (
                  <Link
                    href="/sign-in"
                    className="tap-44 rounded-glam-sm px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    Sign in
                  </Link>
                )}

                <ThemeToggle />
              </nav>
            </div>
          </header>

          <main
            data-page-shell
            className="mx-auto w-full max-w-[var(--glam-page-max)] flex-1 px-4 py-6"
          >
            {children}
          </main>

          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
