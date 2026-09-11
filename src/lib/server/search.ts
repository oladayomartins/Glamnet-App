import { prisma } from "./prisma";

export interface SearchResult {
  serviceId: string;
  name: string;
  description: string;
  category: string;
  kind: string;
  priceMinor: number;
  durationMinutes: number;
  /** Approved providers who can deliver this service in the searched area. */
  providers: {
    id: string;
    name: string;
    rating: number;
    completedBookings: number;
    hubId: string;
    hubName: string;
    sector: string;
    city: string;
  }[];
}

/**
 * Service + location search (the customer's entry point).
 *
 * Matches services on name, description and category, then attaches the
 * approved providers who actually deliver each one in the requested area — so
 * a result is always something that can be booked, not a catalogue entry with
 * nobody behind it. A service with no eligible provider is dropped.
 */
export async function searchServices(
  query: string,
  location: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  const loc = location.trim();

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: {
      providers: {
        where: {
          provider: {
            approvalStatus: "APPROVED",
            isAcceptingWork: true,
            ...(loc
              ? {
                  hub: {
                    OR: [
                      { city: { contains: loc, mode: "insensitive" } },
                      { sector: { contains: loc, mode: "insensitive" } },
                      { name: { contains: loc, mode: "insensitive" } },
                    ],
                  },
                }
              : {}),
          },
        },
        include: {
          provider: {
            include: { hub: { select: { id: true, name: true, sector: true, city: true } } },
          },
        },
      },
    },
  });

  return services
    .map((service) => ({
      serviceId: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      kind: service.kind,
      priceMinor: service.priceMinor,
      durationMinutes: service.durationMinutes,
      providers: service.providers
        .map((link) => ({
          id: link.provider.id,
          name: link.provider.name,
          rating: link.provider.rating,
          completedBookings: link.provider.completedBookings,
          hubId: link.provider.hub.id,
          hubName: link.provider.hub.name,
          sector: link.provider.hub.sector,
          city: link.provider.hub.city,
        }))
        .sort((a, b) => b.rating - a.rating || b.completedBookings - a.completedBookings),
    }))
    // Nothing bookable behind it is not a result.
    .filter((result) => result.providers.length > 0);
}

/** Cities and sectors that currently have approved, working providers. */
export async function searchableAreas() {
  const hubs = await prisma.hub.findMany({
    where: {
      providers: { some: { approvalStatus: "APPROVED", isAcceptingWork: true } },
    },
    orderBy: { city: "asc" },
    select: { id: true, name: true, city: true, sector: true },
  });
  return hubs;
}
