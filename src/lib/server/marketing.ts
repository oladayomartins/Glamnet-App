import { prisma } from "./prisma";
import {
  addDays,
  startOfLocalDay,
  type ProviderSchedule,
} from "@/lib/domain/availability";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { isFreeTonight } from "./openings";
import { listCategories } from "./categories";
import { cityTiles } from "@/lib/domain/cities";
import { hiddenCityNames, listCities } from "./cities";

/**
 * Everything the marketing page shows, derived from real records.
 *
 * Nothing here is a hard-coded headline figure. If the marketplace has six
 * vendors the page says six — inflating it would be inventing social proof,
 * and the numbers would contradict the search results one click away.
 */
export async function getMarketingData() {
  const now = new Date();
  const dayStart = startOfLocalDay(now);
  const dayEnd = addDays(dayStart, 1);

  const [providers, services, hubs] = await Promise.all([
    prisma.provider.findMany({
      where: { approvalStatus: "APPROVED", isAcceptingWork: true },
      // Admin-featured vendors lead the rail.
      orderBy: [{ isFeatured: "desc" }, { rating: "desc" }, { completedBookings: "desc" }],
      select: {
        id: true,
        name: true,
        bio: true,
        rating: true,
        completedBookings: true,
        approvalStatus: true,
        avatarUrl: true,
        slug: true,
        isVerified: true,
        hub: {
          select: {
            id: true,
            name: true,
            city: true,
            sector: true,
            travelFeeMinor: true,
          },
        },
        services: {
          select: {
            service: {
              select: {
                name: true,
                category: true,
                kind: true,
                priceMinor: true,
              },
            },
          },
        },
        // Today's calendar only — enough to answer "free tonight?" without
        // pulling a vendor's whole history onto the home page.
        availability: true,
        timeOff: { where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } } },
        bookings: {
          where: {
            status: { in: [...CALENDAR_HOLDING_STATUSES] },
            appointmentStartAt: { lt: dayEnd },
            reservedUntilAt: { gt: dayStart },
          },
          select: { appointmentStartAt: true, reservedUntilAt: true },
        },
        // Reviews, not completed jobs: the card shows how many people have
        // actually rated this vendor.
        _count: { select: { bookings: { where: { rating: { not: null } } } } },
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
        imageUrl: true,
      },
    }),
    prisma.hub.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        sector: true,
        _count: {
          // Counted exactly as the city directory lists them, so the number on
          // a tile is the number of pros you see after tapping it.
          select: {
            providers: {
              where: { approvalStatus: "APPROVED", isVerified: true, isAcceptingWork: true, slug: { not: null } },
            },
          },
        },
      },
    }),
  ]);

  // One tile per category, priced from the cheapest real service in it, so the
  // "from" figure is always something a customer can actually book.
  const categoryMap = new Map<
    string,
    { count: number; fromMinor: number; imageUrl: string }
  >();
  for (const service of services) {
    if (service.kind === "ADDON") continue;
    const existing = categoryMap.get(service.category);
    categoryMap.set(service.category, {
      count: (existing?.count ?? 0) + 1,
      fromMinor: Math.min(existing?.fromMinor ?? Infinity, service.priceMinor),
      // First real image in the category represents it, so a tile gets
      // photography as soon as any one service has it.
      imageUrl: existing?.imageUrl || service.imageUrl,
    });
  }

  /*
   * The phrases the search bar cycles through.
   *
   * Taken from services a vendor on the platform right now actually offers,
   * not from a hand-written list: the bar is the first promise the page makes
   * about what is bookable, and a placeholder suggesting something nobody
   * provides breaks that promise before the customer has typed anything.
   * Vendors are already ordered by rating, so the best-served work leads.
   */
  const searchHints: string[] = [];
  for (const provider of providers) {
    for (const link of provider.services) {
      if (link.service.kind === "ADDON") continue;
      if (searchHints.length >= 6) break;
      if (!searchHints.includes(link.service.name)) {
        searchHints.push(link.service.name);
      }
    }
  }

  // Only categories an admin has left visible, in the admin's order, with the
  // admin's tile photo when one is set.
  const managed = await listCategories();
  const categories = managed
    .filter((category) => categoryMap.has(category.name))
    .map((category) => {
      const value = categoryMap.get(category.name)!;
      return {
        name: category.name,
        slug: category.slug,
        ...value,
        imageUrl: category.imageUrl || value.imageUrl,
      };
    });

  // Vendors who can deliver each category, so the category tile can state a
  // live count rather than a catalogue size.
  const providerCountByCategory = new Map<string, number>();
  for (const provider of providers) {
    const covered = new Set(
      provider.services
        .filter((link) => link.service.kind !== "ADDON")
        .map((link) => link.service.category),
    );
    for (const category of covered) {
      providerCountByCategory.set(
        category,
        (providerCountByCategory.get(category) ?? 0) + 1,
      );
    }
  }

  // Every launch city is listed from day one; the counts grow as pros there
  // go live, and a city off the list joins once it has a live pro.
  const cities = cityTiles(
    await listCities(),
    hubs.map((hub) => ({
      city: hub.city,
      hubId: hub.id,
      sector: hub.sector,
      providerCount: hub._count.providers,
    })),
    await hiddenCityNames(),
  );

  const ratings = providers.map((p) => p.rating);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return {
    providers: providers.map((provider) => {
      const basePrices = provider.services
        .filter((link) => link.service.kind !== "ADDON")
        .map((link) => link.service.priceMinor);

      const schedule: ProviderSchedule = {
        providerId: provider.id,
        workingWindows: provider.availability.map((window) => ({
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })),
        reservations: provider.bookings.map((booking) => ({
          startAt: booking.appointmentStartAt,
          endAt: booking.reservedUntilAt,
        })),
        blocks: provider.timeOff.map((block) => ({
          startAt: block.startAt,
          endAt: block.endAt,
        })),
      };

      return {
        id: provider.id,
        name: provider.name,
        bio: provider.bio,
        rating: provider.rating,
        reviewCount: provider._count.bookings,
        completedBookings: provider.completedBookings,
        avatarUrl: provider.avatarUrl,
        hubId: provider.hub.id,
        city: provider.hub.city,
        sector: provider.hub.sector,
        travelFeeMinor: provider.hub.travelFeeMinor,
        fromMinor: basePrices.length > 0 ? Math.min(...basePrices) : null,
        vetted: provider.approvalStatus === "APPROVED",
        /** Set when the vendor has a live storefront to link to. */
        storefrontSlug: provider.isVerified && provider.slug ? provider.slug : null,
        freeTonight: isFreeTonight(schedule, now),
        specialities: [
          ...new Set(provider.services.map((link) => link.service.category)),
        ],
      };
    }),
    categories: categories.map((category) => ({
      ...category,
      providerCount: providerCountByCategory.get(category.name) ?? 0,
    })),
    cities,
    searchHints,
    stats: {
      providerCount: providers.length,
      averageRating,
      serviceCount: services.filter((s) => s.kind !== "ADDON").length,
      cityCount: cities.filter((city) => city.providerCount > 0).length,
    },
  };
}
