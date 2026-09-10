import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GlamNetPin } from "@/components/brand";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPricingContext } from "@/lib/server/emergency-config";

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

const brandMono = JetBrains_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GLAMNET — beauty, booked to your door",
  description:
    "Book vetted beauty professionals at your address, with short-notice emergency availability.",
  applicationName: "GLAMNET",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GLAMNET" },
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

const NAV = [
  { href: "/", label: "Book" },
  { href: "/provider", label: "Provider" },
  { href: "/admin", label: "Admin" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The threshold is an admin-configurable commercial parameter, so the shell
  // states the rule from config rather than repeating a hard-coded "12 hours".
  const { thresholdMinutes } = await getPricingContext();
  const thresholdHours = Math.round(thresholdMinutes / 60);

  return (
    <html
      lang="en-GB"
      // next-themes writes data-theme here before paint, which React would
      // otherwise flag as a hydration mismatch.
      suppressHydrationWarning
      className={`${brandSans.variable} ${brandMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <ThemeProvider>
          <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
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
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="tap-44 rounded-glam-sm px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                ))}
                <ThemeToggle />
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {children}
          </main>

          <footer className="safe-bottom mt-8 border-t border-line px-4 pt-4 text-center text-xs text-ink-muted">
            Emergency bookings are appointments requested within {thresholdHours}{" "}
            hours. The surcharge is always shown before payment.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
