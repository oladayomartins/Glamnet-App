import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** Per group, so one popular word cannot fill the whole list. */
const PER_GROUP = 4;

/**
 * GET /api/search/suggestions?q= — typeahead for the marketplace search.
 *
 * Public, because it only reads the catalogue a customer can already browse:
 * service names, the areas covered, and vendors who are approved and taking
 * work. Nothing here is scoped to a viewer, so there is no session to check
 * and nothing a signed-out visitor could learn that the search page would not
 * already tell them.
 *
 * Every suggestion is something that leads somewhere. A service with no
 * vendor behind it, or a vendor who is not taking work, is not offered —
 * the point of a suggestion is that acting on it produces results.
 */
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    // One character matches most of the catalogue and teaches the customer
    // nothing, so the list stays closed until the query is worth answering.
    if (query.length < 2) {
      return NextResponse.json({ query, groups: [] });
    }

    const contains = { contains: query, mode: "insensitive" as const };
    const bookable = {
      provider: { approvalStatus: "APPROVED", isAcceptingWork: true },
    };

    const [services, providers, hubs] = await Promise.all([
      prisma.service.findMany({
        where: {
          isActive: true,
          providers: { some: bookable },
          OR: [{ name: contains }, { category: contains }],
        },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        take: PER_GROUP,
        select: { id: true, name: true, category: true, priceMinor: true },
      }),
      prisma.provider.findMany({
        where: {
          approvalStatus: "APPROVED",
          isAcceptingWork: true,
          name: contains,
        },
        orderBy: [{ rating: "desc" }],
        take: PER_GROUP,
        select: {
          id: true,
          name: true,
          rating: true,
          hub: { select: { city: true, sector: true } },
        },
      }),
      prisma.hub.findMany({
        where: {
          providers: { some: { approvalStatus: "APPROVED", isAcceptingWork: true } },
          OR: [{ city: contains }, { sector: contains }],
        },
        orderBy: { city: "asc" },
        take: PER_GROUP,
        select: { id: true, city: true, sector: true },
      }),
    ]);

    const groups = [
      {
        key: "services",
        label: "Services",
        items: services.map((service) => ({
          id: service.id,
          label: service.name,
          hint: service.category,
          href: `/search?q=${encodeURIComponent(service.name)}`,
        })),
      },
      {
        key: "providers",
        label: "Providers",
        items: providers.map((provider) => ({
          id: provider.id,
          label: provider.name,
          hint: `${provider.hub.city} · ${provider.rating.toFixed(1)}★`,
          href: `/providers/${provider.id}`,
        })),
      },
      {
        key: "areas",
        label: "Areas",
        items: hubs.map((hub) => ({
          id: hub.id,
          label: hub.city,
          hint: hub.sector,
          href: `/search?location=${encodeURIComponent(hub.city)}`,
        })),
      },
    ].filter((group) => group.items.length > 0);

    return NextResponse.json({ query, groups });
  } catch (error) {
    return errorResponse(error);
  }
}
