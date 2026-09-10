import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

/** GET /api/providers — provider directory, used to switch dashboards in the demo. */
export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rating: true,
        completedBookings: true,
        bio: true,
        isAcceptingWork: true,
        hub: { select: { name: true, sector: true } },
      },
    });
    return NextResponse.json({ providers });
  } catch (error) {
    return errorResponse(error);
  }
}
