import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/ads/:id/click — count a click and forward to the ad's link.
 *
 * The destination comes from the database, never the query string, so this
 * cannot be used as an open redirect.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = new URL("/", request.url);
  try {
    const ad = await prisma.adPlacement.update({
      where: { id },
      data: { clicks: { increment: 1 } },
      select: { linkUrl: true },
    });
    if (!ad.linkUrl) return NextResponse.redirect(home, 303);
    return NextResponse.redirect(new URL(ad.linkUrl, request.url), 303);
  } catch {
    return NextResponse.redirect(home, 303);
  }
}
