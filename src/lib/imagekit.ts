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
 * Brand artwork that lives in the media library but is not uploaded through
 * the app — the marketing photography, referenced by path.
 *
 * Built from the configured endpoint rather than hard-coded in full, so an
 * unconfigured deployment gets `null` and the slot falls back to the brand
 * metal, exactly as an unset provider photo does. It also means the account
 * id lives in one place.
 */
export function brandImageUrl(path: string): string | null {
  const endpoint = imageKitEndpoint();
  return endpoint ? `${endpoint}${path}` : null;
}

/** The home page hero: a makeup artist at work, warm low light. */
export const HERO_IMAGE_PATH = "/GlamNet App Hero Image.png";

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

/** The tile image for a category, preferring anything really uploaded. */
export function categoryImageUrl(
  category: string,
  uploadedUrl?: string,
): string | null {
  if (uploadedUrl) return uploadedUrl;
  const path = CATEGORY_IMAGE_PATHS[category];
  return path ? brandImageUrl(path) : null;
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
 * a booking embed a tracker that fires for every provider and admin who opens
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
