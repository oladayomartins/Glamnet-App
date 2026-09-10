import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

/**
 * GET /api/services?hubId=… — the service catalogue.
 *
 * Filtering by hub returns only services at least one provider there can
 * actually deliver, so the basket cannot be built out of unbookable work.
 */
export async function GET(request: Request) {
  try {
    const hubId = new URL(request.url).searchParams.get("hubId");

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(hubId ? { providers: { some: { provider: { hubId } } } } : {}),
      },
      orderBy: [{ kind: "asc" }, { category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}
