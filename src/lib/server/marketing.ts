import { prisma } from "./prisma";

/**
 * Everything the marketing page shows, derived from real records.
 *
 * Nothing here is a hard-coded headline figure. If the marketplace has six
 * providers the page says six — inflating it would be inventing social proof,
 * and the numbers would contradict the search results one click away.
 */
export async function getMarketingData() {
  const [providers, services, hubs] = await Promise.all([
    prisma.provider.findMany({
      where: { approvalStatus: "APPROVED", isAcceptingWork: true },
      orderBy: [{ rating: "desc" }, { completedBookings: "desc" }],
      select: {
        id: true,
        name: true,
        bio: true,
        rating: true,
        completedBookings: true,
        hub: { select: { id: true, name: true, city: true, sector: true } },
        services: { select: { service: { select: { category: true } } } },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        kind: true,
        priceMinor: true,
        durationMinutes: true,
      },
    }),
    prisma.hub.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        sector: true,
        _count: {
          select: { providers: { where: { approvalStatus: "APPROVED" } } },
        },
      },
    }),
  ]);

  // One tile per category, priced from the cheapest real service in it, so the
  // "from" figure is always something a customer can actually book.
  const categoryMap = new Map<string, { count: number; fromMinor: number }>();
  for (const service of services) {
    if (service.kind === "ADDON") continue;
    const existing = categoryMap.get(service.category);
    categoryMap.set(service.category, {
      count: (existing?.count ?? 0) + 1,
      fromMinor: Math.min(existing?.fromMinor ?? Infinity, service.priceMinor),
    });
  }

  const categories = [...categoryMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.count - a.count);

  const cities = [...new Map(hubs.map((hub) => [hub.city, hub])).values()]
    .map((hub) => ({
      city: hub.city,
      hubId: hub.id,
      sector: hub.sector,
      providerCount: hub._count.providers,
    }))
    .filter((city) => city.providerCount > 0)
    .sort((a, b) => b.providerCount - a.providerCount);

  const ratings = providers.map((p) => p.rating);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return {
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      bio: provider.bio,
      rating: provider.rating,
      completedBookings: provider.completedBookings,
      hubId: provider.hub.id,
      city: provider.hub.city,
      sector: provider.hub.sector,
      specialities: [
        ...new Set(provider.services.map((link) => link.service.category)),
      ],
    })),
    categories,
    cities,
    stats: {
      providerCount: providers.length,
      averageRating,
      serviceCount: services.filter((s) => s.kind !== "ADDON").length,
      cityCount: cities.length,
    },
  };
}
