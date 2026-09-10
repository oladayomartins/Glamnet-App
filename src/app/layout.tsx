import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getPricingContext } from "@/lib/server/emergency-config";

/**
 * Typeface placeholders, paired with the token layer in globals.css.
 * The real families come from the GlamNet Brand Guide; swapping them means
 * changing these two imports and the --font-brand-* variables they feed.
 */
const brandSans = Inter({
  variable: "--font-brand-sans",
  subsets: ["latin"],
});

const brandDisplay = Playfair_Display({
  variable: "--font-brand-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GLAMNET — beauty, booked to your door",
  description:
    "Book vetted beauty professionals at your address, with short-notice emergency availability.",
  applicationName: "GLAMNET",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GLAMNET" },
};

export const viewport: Viewport = {
  themeColor: "#542a50",
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
      className={`${brandSans.variable} ${brandDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link
              href="/"
              className="font-display text-xl font-bold tracking-[0.2em] text-brand-700"
            >
              GLAMNET
            </Link>
            <nav className="flex items-center gap-1" aria-label="Main">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-glam-sm px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

        <footer className="safe-bottom mt-8 border-t border-line px-4 pt-4 text-center text-xs text-ink-muted">
          Emergency bookings are appointments requested within {thresholdHours}{" "}
          hours. The surcharge is always shown before payment.
        </footer>
      </body>
    </html>
  );
}
