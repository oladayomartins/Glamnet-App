/**
 * Google Analytics 4, behind consent.
 *
 * GLAMNET serves the UK, where PECR requires opt-in before any non-essential
 * cookie is set — analytics included. So nothing from Google loads, and no
 * event leaves the browser, until the visitor has pressed "Accept" on the
 * cookie banner. Rejecting (or never answering) means GA is never fetched at
 * all; that is stricter than Consent Mode's cookieless pings, deliberately.
 *
 * Every event goes through `track`, which is a silent no-op until GA has been
 * booted. Call sites therefore never need to know about consent, and a
 * missing measurement ID (development, previews) costs nothing.
 *
 * Money is carried as integer minor units everywhere else in the codebase;
 * GA4 wants major units, so the conversion happens here, once.
 */

/** The live property. Only used on the production deployment by default. */
export const DEFAULT_GA_MEASUREMENT_ID = "G-NMYSZW0LM9";

export const CURRENCY = "GBP";

/**
 * The measurement ID for this deployment, or null to disable GA entirely.
 *
 * Server-only: `isProduction` comes from VERCEL_ENV, which is not exposed to
 * the browser. An explicit NEXT_PUBLIC_GA_MEASUREMENT_ID wins (set it to a
 * test property to debug on a preview); otherwise only production reports,
 * so preview and local traffic never pollutes the live numbers.
 */
export function resolveMeasurementId(
  explicit: string | undefined,
  isProduction: boolean,
): string | null {
  const trimmed = explicit?.trim();
  if (trimmed) return /^G-[A-Z0-9]+$/i.test(trimmed) ? trimmed : null;
  return isProduction ? DEFAULT_GA_MEASUREMENT_ID : null;
}

// --- Consent ------------------------------------------------------------------

export type ConsentChoice = "granted" | "denied";

const CONSENT_KEY = "glamnet:analytics-consent";
const CONSENT_EVENT = "glamnet:consent-change";

/** Versioned so a material change to what we collect can re-ask everyone. */
const CONSENT_VERSION = 1;

export function parseConsent(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { v?: number; choice?: string };
    if (value.v !== CONSENT_VERSION) return null;
    return value.choice === "granted" || value.choice === "denied" ? value.choice : null;
  } catch {
    return null;
  }
}

export function readConsent(): ConsentChoice | null {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    // Storage blocked (private mode, strict settings): treat as unanswered.
    return null;
  }
}

/** Record a choice, or clear it (null) so the banner asks again. */
export function writeConsent(choice: ConsentChoice | null): void {
  try {
    if (choice === null) window.localStorage.removeItem(CONSENT_KEY);
    else window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, choice, at: Date.now() }));
  } catch {
    // Unpersistable; the in-page state below still applies for this visit.
  }
  sessionChoice = choice;
  if (choice === "denied") revokeAnalytics();
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Holds the choice for this page view when storage is unavailable. */
let sessionChoice: ConsentChoice | null = null;

export function currentConsent(): ConsentChoice | null {
  return readConsent() ?? sessionChoice;
}

/** For useSyncExternalStore: fires on this tab's changes and other tabs'. */
export function subscribeConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// --- gtag bootstrap -------------------------------------------------------------

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let bootedId: string | null = null;

/**
 * The inline bootstrap rendered into every page's HTML (see <GoogleTag>).
 *
 * It defines gtag with every consent type denied, and deliberately does NOT
 * call `config`: without a config command gtag.js sends nothing and sets no
 * cookie. The tag is still present in the page source, which is what Google's
 * "Test installation" and Tag Assistant look for; data only starts flowing
 * once `bootAnalytics` runs after the visitor accepts.
 */
export const GTAG_BOOTSTRAP = [
  "window.dataLayer=window.dataLayer||[];",
  "function gtag(){dataLayer.push(arguments);}",
  "window.gtag=gtag;",
  "gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});",
  "gtag('set',{allow_google_signals:false,allow_ad_personalization_signals:false});",
  "gtag('js',new Date());",
].join("");

/**
 * Grant analytics consent and configure the property. Idempotent.
 *
 * Automatic page views are off: the App Router navigates client-side, and the
 * page view is sent by <Analytics> on every route change with a scrubbed URL
 * (see `sanitizeLocation`). Turn off "Page changes based on browser history
 * events" under Enhanced measurement in GA4 too, or navigations count twice.
 */
export function bootAnalytics(measurementId: string): void {
  if (bootedId === measurementId) return;
  if (typeof window.gtag !== "function") {
    // The inline bootstrap normally defines this; fall back if it was blocked.
    window.dataLayer = window.dataLayer ?? [];
    // gtag.js reads `arguments` objects, not arrays — this must stay a
    // function expression using `arguments`.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
  }
  // Analytics only; every advertising consent type stays denied.
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("config", measurementId, {
    send_page_view: false,
    page_location: sanitizeLocation(window.location.href),
    page_referrer: sanitizeReferrer(document.referrer),
  });
  bootedId = measurementId;
}

function revokeAnalytics(): void {
  if (bootedId && window.gtag) {
    window.gtag("consent", "update", { analytics_storage: "denied" });
  }
  bootedId = null;
  // Remove the cookies GA already set; the choice to leave must be real.
  for (const name of document.cookie.split(";").map((part) => part.split("=")[0].trim())) {
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid") {
      const host = window.location.hostname;
      const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
  }
}

export function analyticsEnabled(): boolean {
  return bootedId !== null && typeof window.gtag === "function";
}

/** Associate hits with the signed-in account (internal id only, never PII). */
export function identify(user: { id: string; role: string } | null): void {
  if (!analyticsEnabled() || !bootedId) return;
  window.gtag!("config", bootedId, { send_page_view: false, user_id: user?.id ?? null });
  window.gtag!("set", "user_properties", {
    user_role: user ? user.role.toLowerCase() : "guest",
  });
}

// --- URLs -----------------------------------------------------------------------

/**
 * Query parameters allowed to reach GA. Everything else is dropped.
 *
 * An allowlist, not a blocklist: sign-in, confirmation and unsubscribe links
 * carry one-time tokens in the query, and GA must never receive those. What
 * survives is campaign attribution and the marketplace's own search filters.
 */
const ALLOWED_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  // Search and directory filters (/search, /salons, /book).
  "q",
  "location",
  "maxPrice",
  "minRating",
  "availableToday",
  "sector",
  "service",
  "city",
  // Storefront attribution: marketplace directory vs. the pro's own link.
  "via",
]);

export function sanitizeLocation(href: string): string {
  try {
    const url = new URL(href);
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (ALLOWED_PARAMS.has(key)) kept.append(key, value);
    });
    const query = kept.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

/** Referrers keep only origin + path: another site's query is not ours to send. */
export function sanitizeReferrer(referrer: string): string {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function pageView(href: string, title: string): void {
  if (!analyticsEnabled()) return;
  const location = sanitizeLocation(href);
  // `set` so every event that follows on this page carries the clean URL,
  // not the raw one gtag would otherwise read from window.location.
  window.gtag!("set", { page_location: location, page_title: title });
  window.gtag!("event", "page_view", { page_location: location, page_title: title });
}

// --- Events ---------------------------------------------------------------------

export function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

/** A GA4 ecommerce item. For GLAMNET an item is a service on a vendor's menu. */
export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  /** The vendor, so revenue can be split by who earned it. */
  affiliation?: string;
  /** The hub / service category, e.g. "Braids & Locs". */
  item_category?: string;
  /** The city or area. */
  item_category2?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  index?: number;
}

export function serviceItem(service: {
  id: string;
  name: string;
  priceMinor?: number;
  category?: string | null;
  vendor?: string | null;
  city?: string | null;
  kind?: string | null;
}): AnalyticsItem {
  return {
    item_id: service.id,
    item_name: service.name,
    ...(service.vendor ? { affiliation: service.vendor } : {}),
    ...(service.category ? { item_category: service.category } : {}),
    ...(service.city ? { item_category2: service.city } : {}),
    ...(service.kind ? { item_variant: service.kind.toLowerCase() } : {}),
    ...(service.priceMinor !== undefined ? { price: toMajor(service.priceMinor) } : {}),
    quantity: 1,
  };
}

/**
 * Where a booking came from. The marketplace's two engines are measured
 * separately: a broadcast to nearby pros versus a direct booking with one.
 */
export type BookingChannel = "broadcast" | "search_offer" | "storefront";

/**
 * For storefront bookings: found through the marketplace directory, or via
 * the pro's own shared link (which carries 0% commission). The split is the
 * marketplace's core health metric, so it rides on every storefront event.
 */
export type BookingSource = "marketplace" | "direct_link";

type EventParams = Record<string, unknown>;

/**
 * The event catalogue. Names follow GA4's recommended events wherever one
 * exists, so the built-in ecommerce and funnel reports work unmodified; the
 * rest are GLAMNET-specific and snake_case to match.
 */
export interface EventMap {
  // Recommended events.
  sign_up: { method: string; user_type: "customer" | "vendor" };
  login: { method: string; user_type?: string };
  search: { search_term: string; search_location?: string; results_count?: number };
  view_item_list: { item_list_id: string; item_list_name: string; items: AnalyticsItem[] };
  view_item: { currency: string; value?: number; items: AnalyticsItem[]; vendor_id?: string; booking_source?: BookingSource };
  add_to_cart: { currency: string; value: number; items: AnalyticsItem[] };
  remove_from_cart: { currency: string; value: number; items: AnalyticsItem[] };
  begin_checkout: {
    currency: string;
    value: number;
    items: AnalyticsItem[];
    booking_channel: BookingChannel;
    booking_source?: BookingSource;
    booking_type?: string;
    coupon?: string;
  };
  add_payment_info: { currency: string; value: number; items: AnalyticsItem[]; payment_type: string; booking_channel: BookingChannel };
  purchase: {
    transaction_id: string;
    currency: string;
    value: number;
    items: AnalyticsItem[];
    booking_channel: BookingChannel;
    booking_source?: BookingSource;
    booking_type?: string;
    coupon?: string;
    tip?: number;
  };
  // GLAMNET events.
  select_time_slot: { booking_channel: BookingChannel; booking_type?: string; days_ahead: number };
  booking_cancelled: { transaction_id: string; cancellation_fee: number; currency: string };
  review_submitted: { rating: number; has_note: boolean };
  vendor_onboarding_step: { step_name: string; step_number: number };
  vendor_application_submitted: Record<string, never>;
  /** A pro tapping accept on a broadcast; "failed" is usually another pro getting there first. */
  vendor_accept_booking: { outcome: "accepted" | "failed" };
  apply_promo_code: { coupon: string; success: boolean };
}

export function track<K extends keyof EventMap>(name: K, params: EventMap[K]): void;
export function track(name: string, params?: EventParams): void;
export function track(name: string, params: EventParams = {}): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  try {
    window.gtag!("event", name, params);
  } catch {
    // Analytics must never break a booking.
  }
}

/** Whole days between now and an ISO start time — for lead-time analysis. */
export function daysAhead(startAtIso: string, now = Date.now()): number {
  const diff = new Date(startAtIso).getTime() - now;
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 86_400_000)) : 0;
}

/**
 * The booking conversion, shared by all three checkout paths.
 *
 * A GLAMNET booking is a card *hold* — money is only captured at the PIN —
 * so `purchase` marks the customer committing (booking placed, card
 * authorised), and `value` is the gross booking value the customer will pay,
 * not GLAMNET's commission. The booking id is the transaction id, which GA4
 * de-duplicates on, so a double-fire cannot double-count revenue.
 */
export function trackBookingPlaced({
  bookingId,
  channel,
  items,
  totalMinor,
  bookingType,
  cardAuthorised,
  coupon,
  tipMinor,
  source,
}: {
  bookingId: string;
  channel: BookingChannel;
  items: AnalyticsItem[];
  totalMinor: number;
  bookingType?: string;
  /** True when this follows a card being authorised on the page. */
  cardAuthorised: boolean;
  coupon?: string;
  tipMinor?: number;
  source?: BookingSource;
}): void {
  const value = toMajor(totalMinor);
  if (cardAuthorised) {
    track("add_payment_info", { currency: CURRENCY, value, items, payment_type: "card", booking_channel: channel });
  }
  track("purchase", {
    transaction_id: bookingId,
    currency: CURRENCY,
    value,
    items,
    booking_channel: channel,
    ...(source ? { booking_source: source } : {}),
    ...(bookingType ? { booking_type: bookingType.toLowerCase() } : {}),
    ...(coupon ? { coupon } : {}),
    ...(tipMinor ? { tip: toMajor(tipMinor) } : {}),
  });
}
