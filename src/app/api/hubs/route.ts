import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

/** GET /api/hubs — Beauty Hubs available to book. */
export async function GET() {
  try {
    const hubs = await prisma.hub.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
        travelFeeMinor: true,
        _count: { select: { providers: true } },
      },
    });
    return NextResponse.json({ hubs });
  } catch (error) {
    return errorResponse(error);
  }
}
