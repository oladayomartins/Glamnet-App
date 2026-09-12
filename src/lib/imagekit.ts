/**
 * ImageKit configuration.
 *
 * Everything here tolerates the integration being unconfigured. Image features
 * then hide themselves rather than throwing, which keeps a missing environment
 * variable from taking down the booking flow — the failure mode this
 * deployment has already been bitten by twice.
 */

/** Public delivery endpoint, e.g. https://ik.imagekit.io/glamnet. */
export function imageKitEndpoint(): string | null {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim();
  return endpoint ? endpoint.replace(/\/$/, "") : null;
}

/** Public key. Safe in the browser — it cannot authorise an upload alone. */
export function imageKitPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY?.trim() || null;
}

/** True when uploads and delivery can both work. */
export function isImageKitConfigured(): boolean {
  return Boolean(imageKitEndpoint() && imageKitPublicKey());
}

/**
 * The library the brand's own artwork lives in.
 *
 * Falls back to the known origin when no endpoint is configured, rather than
 * returning null. Uploads still need the full configuration — they need a key
 * to sign with — but artwork that is already published and referenced from our
 * own source does not, and tying it to a deployment variable meant one unset
 * value silently replaced every photograph on the marketing pages with a
 * gradient. That is the correct behaviour for a vendor who has not uploaded
 * a photo; it is not correct for a picture we know exists.
 */
const BRAND_MEDIA_ORIGIN = "https://ik.imagekit.io/glamnetapp";

export function brandMediaOrigin(): string {
  return imageKitEndpoint() ?? BRAND_MEDIA_ORIGIN;
}

/**
 * The home page hero banner: 8:3, subject on the right, with deliberate cream
 * negative space on the left for the copy to sit in. The layout depends on
 * that composition, so a replacement needs the same shape.
 */
export const HERO_IMAGE_PATH = "/Hero Banner - Glamnet App.png";

/**
 * The "leave us a review on Google" button shown in the hero.
 *
 * A call to action rather than a certification: it claims nothing about a
 * rating GLAMNET holds, which is why it can sit beside figures the platform
 * calculated without reading as one of them.
 *
 * It says "click here", so it only renders when there is somewhere to click —
 * see {@link GOOGLE_REVIEW_URL}.
 */
export const GOOGLE_REVIEW_BADGE_PATH = "/6293834730fb025780ee2968.png";

/**
 * Where that button goes: the GLAMNET business's own Google review form.
 *
 * Google builds it from the Place ID of the business listing —
 * `https://search.google.com/local/writereview?placeid=<PLACE ID>` — and
 * there is no generic address that works without one.
 *
 * Empty until that ID is to hand, and the button does not render while it is
 * empty. A button reading "click here" that goes nowhere is worse on a home
 * page than no button: it is the one thing a visitor is invited to do, and it
 * fails silently.
 */
export const GOOGLE_REVIEW_URL = "";

/**
 * Artwork for the category tiles, keyed by the category name as it is stored
 * on the service.
 *
 * A fallback, not an override: a category whose services carry uploaded
 * photography uses that instead, so adding a real image through the admin
 * never has to come back here. A category with neither falls through to the
 * brand metal like every other image slot.
 */
export const CATEGORY_IMAGE_PATHS: Record<string, string> = {
  Hair: "/Glossy Hair.png",
  Nails: "/Glamnet - Nail Tech.png",
  // Two trailing spaces before the extension, which is how the file is named
  // in the library. Written out rather than trimmed: the name has to match.
  Makeup: "/Glamorous Makeup Application Portrait  .png",
};

/** The artwork path for a category, if one has been drawn for it. */
export function categoryImagePath(category: string): string | null {
  return CATEGORY_IMAGE_PATHS[category] ?? null;
}

/** Where uploaded files live, keyed by what they are. */
export const IMAGE_FOLDERS = {
  reference: "/glamnet/booking-references",
  provider: "/glamnet/providers",
  service: "/glamnet/services",
} as const;

export type ImageFolder = keyof typeof IMAGE_FOLDERS;

/** Only formats a browser can display, and that we can transform. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
] as const;

/** 10 MB — comfortably above a phone photo, well below an abuse vector. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Whether a URL is one we are willing to render.
 *
 * Reference images arrive from customers. Rendering an arbitrary URL would let
 * a booking embed a tracker that fires for every vendor and admin who opens
 * it, so only our own delivery endpoint is trusted.
 */
export function isTrustedImageUrl(url: string): boolean {
  const endpoint = imageKitEndpoint();
  if (!endpoint || !url) return false;
  try {
    return new URL(url).origin === new URL(endpoint).origin;
  } catch {
    return false;
  }
}
