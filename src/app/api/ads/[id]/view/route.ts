import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/ads/:id/view — count one view of an ad that reached the screen.
 *
 * Sent by the ad itself (AdView) once it is mostly visible, so an ad hidden
 * on this device, or below a fold nobody scrolled past, is not counted.
 * Always 204: a lost count is not worth an error in a visitor's console.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.adPlacement
    .updateMany({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch((cause) => console.error("[ads] view count failed", cause));
  return new NextResponse(null, { status: 204 });
}
