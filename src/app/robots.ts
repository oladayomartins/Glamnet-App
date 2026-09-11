import type { MetadataRoute } from "next";
import { isProductionSite, siteUrl } from "@/lib/site";

/**
 * Preview deployments are excluded from search entirely.
 *
 * Without this every preview URL competes with the real site for the same
 * content, which splits ranking and can surface a half-finished build to
 * customers.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  if (!isProductionSite()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in surfaces: nothing here is useful in search, and some of
        // it is personal.
        disallow: [
          "/account",
          "/admin",
          "/admin/",
          "/provider",
          "/provider/",
          "/bookings/",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
