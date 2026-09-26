import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";

/** GET /api/providers — vendor directory, used to switch dashboards in the demo. */
export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      // Pending and rejected applicants are not part of the marketplace.
      where: { approvalStatus: "APPROVED" },
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
