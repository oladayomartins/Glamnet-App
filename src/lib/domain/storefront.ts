/** Vendor storefront handles: glamnet.co/pro/:slug (Directory §C). */

/**
 * Storefront slug: lowercase, hyphenated, 3–40 characters, no leading or
 * trailing hyphen. Used as glamnet.co/pro/:slug.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Routes that must never be claimable as a storefront handle. */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "book",
  "bookings",
  "new",
  "onboarding",
  "pro",
  "provider",
  "sign-in",
  "sign-up",
  "support",
]);

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}
