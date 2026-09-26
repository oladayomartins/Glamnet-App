import { resolveMeasurementId } from "@/lib/analytics";

/**
 * The canonical origin for this deployment.
 *
 * Resolution order matters:
 *  1. NEXT_PUBLIC_SITE_URL — the real domain, set in production.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — the project's production hostname, so a
 *     deployment is still self-describing before the domain is configured.
 *  3. VERCEL_URL — the per-deployment hostname, which is what preview builds
 *     have and is unique per commit.
 *  4. localhost for development.
 *
 * Absolute URLs matter here beyond tidiness: Open Graph images and canonical
 * links are ignored by crawlers and social scrapers when relative, so without
 * a base every share of the marketing page would render without its preview.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}

/** True only on the live production domain — used to gate search indexing. */
export function isProductionSite(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export const SITE_NAME = "GLAMNET";
export const SITE_TAGLINE = "The UK's beauty marketplace";
export const SITE_DESCRIPTION =
  "Find and book verified independent beauty pros near you, anywhere in the UK — braids, bridal glam, nails and massage. Real availability, one honest price, and paid only when you're happy.";

/**
 * The GA4 measurement ID for this deployment, or null when analytics is off.
 * Production only unless NEXT_PUBLIC_GA_MEASUREMENT_ID says otherwise.
 */
export function gaMeasurementId(): string | null {
  return resolveMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, isProductionSite());
}
