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
