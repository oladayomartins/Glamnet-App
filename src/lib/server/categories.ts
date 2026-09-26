import { cache } from "react";
import { prisma } from "./prisma";
import { SPECIALTY_HUBS, type SpecialtyHub } from "@/lib/domain/specialty-hubs";

export interface CategoryView extends SpecialtyHub {
  id: string;
  imageUrl: string;
}

/**
 * The live Specialty Hubs, in the order admins set.
 *
 * Read from the Category table, which admins manage. Falls back to the five
 * built-in hubs if the table is empty or unreachable, so a fresh database or
 * a hiccup never leaves the directory with no tiles at all.
 */
export const listCategories = cache(async (): Promise<CategoryView[]> => {
  try {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (rows.length > 0) {
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        emoji: row.emoji,
        blurb: row.blurb,
        imageUrl: row.imageUrl,
      }));
    }
  } catch (cause) {
    console.error("[categories] falling back to built-in hubs", cause);
  }
  return SPECIALTY_HUBS.map((hub) => ({ ...hub, id: hub.slug, imageUrl: "" }));
});

export async function categoryBySlug(slug: string): Promise<CategoryView | null> {
  return (await listCategories()).find((category) => category.slug === slug) ?? null;
}

export async function categoryByName(name: string): Promise<CategoryView | null> {
  return (await listCategories()).find((category) => category.name === name) ?? null;
}
