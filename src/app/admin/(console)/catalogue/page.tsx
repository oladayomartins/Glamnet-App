import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader } from "../_components/bits";
import { CatalogueManager } from "./catalogue-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categories & services" };

/** Specialty Hubs and the services vendors build their menus from. */
export default async function AdminCataloguePage() {
  await requireRole("ADMIN", "/admin/catalogue");
  const [categories, services] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.service.findMany({
      orderBy: [{ category: "asc" }, { kind: "asc" }, { name: "asc" }],
      include: { _count: { select: { providers: true } } },
    }),
  ]);

  return (
    <div>
      <AdminHeader
        title="Categories & services"
        lede="Categories are the Specialty Hubs clients browse by. Services are what vendors add to their menus, each at their own price."
      />
      <CatalogueManager
        categories={categories.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: category.name,
          emoji: category.emoji,
          blurb: category.blurb,
          imageUrl: category.imageUrl,
          imageFileId: category.imageFileId,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          serviceCount: services.filter((service) => service.category === category.name).length,
        }))}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          category: service.category,
          kind: service.kind as "SERVICE" | "ADDON",
          priceMinor: service.priceMinor,
          durationMinutes: service.durationMinutes,
          isActive: service.isActive,
          vendorCount: service._count.providers,
        }))}
      />
    </div>
  );
}
