import { lookupPlace } from "./geo";
import { distanceKm, outwardCode } from "@/lib/domain/postcode";
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
    select: { id: true, name: true, city: true, sector: true, latitude: true, longitude: true },
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
  // For a postcode, "nearest" means by distance, anywhere in the UK.
  const place = outwardCode(excludeLocation) ? await lookupPlace(excludeLocation) : null;
  if (place) {
    const ranked = areas
      .filter((area) => area.latitude !== null && area.longitude !== null)
      .map((area) => ({ area, km: distanceKm(place, { lat: area.latitude!, lng: area.longitude! }) }))
      .sort((a, b) => a.km - b.km);
    if (ranked[0]) return ranked[0].area;
  }
  return (
    areas.find((area) => area.city.toLowerCase() !== excluded) ?? areas[0] ?? null
  );
}
