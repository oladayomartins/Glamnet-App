import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader } from "../_components/bits";
import { CityManager } from "./city-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cities" };

/** The cities under "Browse by city" on the home page. */
export default async function AdminCitiesPage() {
  await requireRole("ADMIN", "/admin/cities");
  const [cities, hubs] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    // Counted as the home page counts them: live, bookable pros.
    prisma.hub.findMany({
      select: {
        city: true,
        _count: {
          select: {
            providers: {
              where: { approvalStatus: "APPROVED", isVerified: true, isAcceptingWork: true, slug: { not: null } },
            },
          },
        },
      },
    }),
  ]);
  const live = new Map<string, number>();
  for (const hub of hubs) {
    const key = hub.city.toLowerCase();
    live.set(key, (live.get(key) ?? 0) + hub._count.providers);
  }

  return (
    <div>
      <AdminHeader
        title="Cities"
        lede="The cities under “Browse by city” on the home page. Cities with more live pros show first; ties follow the order you set here."
      />
      <CityManager
        cities={cities.map((city) => ({
          id: city.id,
          slug: city.slug,
          name: city.name,
          label: city.label,
          outcode: city.outcode,
          imageUrl: city.imageUrl,
          imageFileId: city.imageFileId,
          sortOrder: city.sortOrder,
          isActive: city.isActive,
          liveCount: live.get(city.name.toLowerCase()) ?? 0,
        }))}
      />
    </div>
  );
}
