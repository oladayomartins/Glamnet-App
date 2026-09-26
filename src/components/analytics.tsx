"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Cookie } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import {
  GTAG_BOOTSTRAP,
  bootAnalytics,
  currentConsent,
  identify,
  pageView,
  subscribeConsent,
  track,
  writeConsent,
  type ConsentChoice,
  type EventMap,
} from "@/lib/analytics";

/** "unknown" on the server and during hydration, so both renders agree. */
function useConsent(): ConsentChoice | null | "unknown" {
  return useSyncExternalStore(subscribeConsent, currentConsent, () => "unknown");
}

/**
 * GA4 for the whole site: the consent banner, the gtag.js loader and a page
 * view on every client-side navigation. Rendered once, from the root layout.
 *
 * `measurementId` is null outside production (see resolveMeasurementId), in
 * which case this renders nothing and no banner is shown — there is nothing
 * to consent to.
 */
export function Analytics({
  measurementId,
  user,
}: {
  measurementId: string | null;
  user: { id: string; role: string } | null;
}) {
  if (!measurementId) return null;
  return (
    <>
      {/* useSearchParams needs a Suspense boundary, or every page would opt
          out of static rendering. */}
      <Suspense fallback={null}>
        <AnalyticsRuntime measurementId={measurementId} user={user} />
      </Suspense>
      <ConsentBanner />
    </>
  );
}

function AnalyticsRuntime({
  measurementId,
  user,
}: {
  measurementId: string;
  user: { id: string; role: string } | null;
}) {
  const consent = useConsent();
  const granted = consent === "granted";
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const userId = user?.id ?? null;
  const role = user?.role ?? null;

  // Order matters: these effects run top to bottom, so gtag is configured
  // before the user is attached, and both before the first page view.
  useEffect(() => {
    if (granted) bootAnalytics(measurementId);
  }, [granted, measurementId]);

  useEffect(() => {
    if (granted) identify(userId && role ? { id: userId, role } : null);
  }, [granted, userId, role]);

  useEffect(() => {
    if (!granted) return;
    // A tick later, so the new route's <title> has been applied.
    const timer = window.setTimeout(() => pageView(window.location.href, document.title), 0);
    return () => window.clearTimeout(timer);
  }, [granted, pathname, search]);

  return null;
}

/**
 * The Google tag itself, in every page's HTML. Server-rendered from the root
 * layout so it is in the page source, where Google's installation checks look.
 * It sends nothing until consent: see GTAG_BOOTSTRAP, which runs inline first.
 */
export function GoogleTag({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null;
  return (
    <>
      <script id="gtag-bootstrap" dangerouslySetInnerHTML={{ __html: GTAG_BOOTSTRAP }} />
      <Script
        id="gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}

/**
 * The PECR/UK GDPR consent banner. Accept and Reject carry equal weight — the
 * ICO is explicit that refusing must be as easy as agreeing — and until one
 * is pressed nothing from Google is loaded.
 */
function ConsentBanner() {
  const consent = useConsent();
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-glam border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5">
        <span
          aria-hidden
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-accent-700 sm:flex"
        >
          <Cookie size={20} weight="fill" />
        </span>
        <p className="flex-1 text-sm text-ink">
          Can we use analytics cookies? They tell us which pages and bookings work and which don&rsquo;t, so we can
          improve GLAMNET. No advertising, and nothing is set unless you say yes.{" "}
          <Link href="/cookies" className="font-semibold text-accent-700 hover:underline">
            Cookie policy
          </Link>
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => writeConsent("denied")}>
            Reject
          </Button>
          <Button variant="secondary" onClick={() => writeConsent("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that re-opens the banner, so a choice can always be changed. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => writeConsent(null)} className={className}>
      Cookie settings
    </button>
  );
}

/** The live choice with both options, for the cookie policy page. */
export function ConsentControls() {
  const consent = useConsent();
  if (consent === "unknown") return null;
  return (
    <div className="flex flex-col gap-3 rounded-glam-sm border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink" role="status">
        Analytics cookies are{" "}
        <strong>{consent === "granted" ? "on" : consent === "denied" ? "off" : "off (you haven't chosen yet)"}</strong>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => writeConsent("denied")} disabled={consent === "denied"}>
          Turn off
        </Button>
        <Button variant="secondary" onClick={() => writeConsent("granted")} disabled={consent === "granted"}>
          Turn on
        </Button>
      </div>
    </div>
  );
}

/**
 * Fire one event when a server-rendered page mounts, e.g. `search` or
 * `view_item`. Re-fires only if `dedupeKey` changes, so a re-render or
 * router.refresh() does not double-count.
 */
export function TrackEvent<K extends keyof EventMap>({
  name,
  params,
  dedupeKey,
}: {
  name: K;
  params: EventMap[K];
  dedupeKey: string;
}) {
  const consent = useConsent();
  const granted = consent === "granted";
  useEffect(() => {
    if (!granted) return;
    // After the page view, which AnalyticsRuntime also defers by a tick.
    const timer = window.setTimeout(() => track(name, params), 0);
    return () => window.clearTimeout(timer);
    // `params` is deliberately excluded: it is a fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granted, name, dedupeKey]);
  return null;
}
