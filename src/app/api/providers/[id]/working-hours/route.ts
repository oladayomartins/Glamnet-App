import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { requireOwnProvider } from "@/lib/auth/provider-guard";

const windowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1_440),
    endMinute: z.number().int().min(0).max(1_440),
  })
  .refine((window) => window.startMinute < window.endMinute, {
    message: "A shift must end after it starts.",
  });

const schema = z.object({ windows: z.array(windowSchema).max(21) });

/**
 * PUT /api/providers/:id/working-hours — replace the weekly pattern.
 *
 * Replace rather than patch: the editor sends the whole week, so there is one
 * obvious meaning for the result and no way for a half-applied update to leave
 * a vendor bookable at a time they removed.
 *
 * Shrinking the week is allowed even when a booking already sits outside the
 * new hours. Working hours decide which slots are *offered*; a commitment
 * already accepted is held by its own reservation and is not up for
 * renegotiation by an edit here.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const denied = requireOwnProvider(auth.user, id);
    if (denied) return denied;

    const { windows } = schema.parse(await request.json());

    await prisma.$transaction([
      prisma.providerAvailability.deleteMany({ where: { providerId: id } }),
      prisma.providerAvailability.createMany({
        data: windows.map((window) => ({ ...window, providerId: id })),
      }),
    ]);

    const saved = await prisma.providerAvailability.findMany({
      where: { providerId: id },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    });

    return NextResponse.json({ windows: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
