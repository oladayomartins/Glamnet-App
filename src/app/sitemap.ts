import { citySlug } from "@/lib/domain/postcode";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";
import { listCities } from "@/lib/server/cities";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Public pages only.
 *
 * Service searches are included because they are the pages a customer would
 * actually arrive on from a search engine — "knotless braids sheffield" should
 * land on results, not the homepage. Only services with an approved vendor
 * are listed, so a crawled page is never an empty result.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/salons`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [services, hubs, providers] = await Promise.all([
      prisma.service.findMany({
        where: {
          isActive: true,
          providers: { some: { provider: { approvalStatus: "APPROVED" } } },
        },
        select: { name: true },
      }),
      // Only cities with a live pro: an empty directory page is not worth indexing.
      prisma.hub.findMany({
        where: { providers: { some: { approvalStatus: "APPROVED" } } },
        select: { id: true, city: true },
      }),
      // Only vendors a customer can actually reach: the profile route 404s
      // for anyone pending, rejected or not taking work, and a sitemap full
      // of 404s is worse than a shorter one.
      prisma.provider.findMany({
        where: { approvalStatus: "APPROVED", isAcceptingWork: true },
        select: { id: true },
      }),
    ]);

    const serviceRoutes = services.map((service) => ({
      url: `${base}/search?q=${encodeURIComponent(service.name)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const cityRoutes = [...new Set([...(await listCities()).map((city) => city.name), ...hubs.map((hub) => hub.city)])].map((city) => ({
      url: `${base}/${citySlug(city)}/salons`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const providerRoutes = providers.map((provider) => ({
      url: `${base}/providers/${provider.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const hubRoutes = hubs.map((hub) => ({
      url: `${base}/book/${hub.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [
      ...staticRoutes,
      ...serviceRoutes,
      ...cityRoutes,
      ...providerRoutes,
      ...hubRoutes,
    ];
  } catch {
    // A sitemap that 500s is worse than a short one: never let a database
    // blip take the whole route down.
    return staticRoutes;
  }
}
