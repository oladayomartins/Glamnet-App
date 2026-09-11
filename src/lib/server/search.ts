import { prisma } from "./prisma";

/**
 * Area lookups for the marketplace.
 *
 * Vendor search itself lives in `offers.ts`: the results page asks for
 * bookable offers — a person, a real start time and a real price — rather than
 * a directory of vendors, so the query that produced the directory is gone
 * rather than kept alongside it.
 */

/** Cities and sectors that currently have approved, working vendors. */
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

/**
 * The nearest area that does have cover, for the zero-results state (§S-02).
 * An empty page that only says "nothing found" is a dead end; this is what it
 * offers instead.
 */
export async function nearestCoveredArea(excludeLocation: string) {
  const areas = await searchableAreas();
  const excluded = excludeLocation.trim().toLowerCase();
  return (
    areas.find((area) => area.city.toLowerCase() !== excluded) ?? areas[0] ?? null
  );
}
