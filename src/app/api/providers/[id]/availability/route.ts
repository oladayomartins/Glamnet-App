import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";

const schema = z.object({ isAcceptingWork: z.boolean() });

/**
 * POST /api/providers/:id/availability — the provider's own on/off switch.
 *
 * Turning work off only stops new broadcasts reaching them; it never releases
 * a booking they have already accepted, which stays in their calendar and in
 * the customer's. A switch that silently cancelled committed work would be a
 * very expensive surprise.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    // A provider may only switch themselves off. Without this, the id in the
    // path would be enough to take a competitor out of the broadcast pool.
    if (auth.user.role !== "ADMIN" && auth.user.providerId !== id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You can only change your own availability.",
          },
        },
        { status: 403 },
      );
    }

    const { isAcceptingWork } = schema.parse(await request.json());
    const provider = await prisma.provider.update({
      where: { id },
      data: { isAcceptingWork },
      select: { id: true, isAcceptingWork: true },
    });

    return NextResponse.json({ provider });
  } catch (error) {
    return errorResponse(error);
  }
}
