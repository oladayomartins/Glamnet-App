import { cache } from "react";
import { prisma } from "./prisma";
import { LAUNCH_CITIES, type LaunchCity } from "@/lib/domain/cities";

/**
 * The cities admins have listed under "Browse by city", in their order.
 *
 * Read from the City table. Falls back to the built-in launch list if the
 * table is empty or unreachable, so the home page never loses the rail.
 */
export const listCities = cache(async (): Promise<LaunchCity[]> => {
  try {
    const rows = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (rows.length > 0) {
      return rows.map((row) => ({
        name: row.name,
        label: row.label || undefined,
        image: row.imageUrl || undefined,
        outcode: row.outcode,
        lat: row.latitude,
        lng: row.longitude,
      }));
    }
  } catch (cause) {
    console.error("[cities] falling back to the built-in list", cause);
  }
  return [...LAUNCH_CITIES];
});

/** Lower-cased names of the cities admins have hidden. */
export const hiddenCityNames = cache(async (): Promise<Set<string>> => {
  try {
    const rows = await prisma.city.findMany({ where: { isActive: false }, select: { name: true } });
    return new Set(rows.map((row) => row.name.toLowerCase()));
  } catch {
    return new Set();
  }
});
