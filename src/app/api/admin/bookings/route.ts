import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

/** Filters offered on the admin booking list (spec §10). */
const FILTERS = [
  "ALL",
  "NORMAL",
  "EMERGENCY",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;

type Filter = (typeof FILTERS)[number];

function whereFor(filter: Filter) {
  switch (filter) {
    case "NORMAL":
    case "EMERGENCY":
      return { bookingType: filter };
    case "CONFIRMED":
    case "COMPLETED":
    case "CANCELLED":
    case "DISPUTED":
      return { status: filter };
    default:
      return {};
  }
}

/** GET /api/admin/bookings?filter=ALL|NORMAL|EMERGENCY|CONFIRMED|… */
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("filter") ?? "ALL";
    const filter = (FILTERS as readonly string[]).includes(raw)
      ? (raw as Filter)
      : "ALL";

    const bookings = await prisma.booking.findMany({
      where: whereFor(filter),
      orderBy: { bookingCreatedAt: "desc" },
      take: 200,
      include: {
        items: true,
        customer: { select: { name: true } },
        provider: { select: { name: true } },
        hub: { select: { sector: true } },
      },
    });

    return NextResponse.json({ filter, filters: FILTERS, bookings });
  } catch (error) {
    return errorResponse(error);
  }
}
