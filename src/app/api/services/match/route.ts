import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { matchServices } from "@/lib/domain/service-search";

export const dynamic = "force-dynamic";

/** Enough to choose between, few enough to read without scrolling. */
const MAX_MATCHES = 5;

/**
 * GET /api/services/match?q= — what the customer's words mean.
 *
 * The discovery layer, and only the discovery layer. It answers with services
 * that exist, priced, with a vendor behind them; the phrasing that got here
 * goes no further than this file. A booking is made against an id from this
 * list or it is not made at all, which is what stops "make me look like
 * Beyoncé for my birthday" from being treated as work anyone agreed to do.
 *
 * With no query it returns the catalogue grouped by category instead — the
 * same endpoint answering "I'm not sure what I need", so browsing and
 * searching can never disagree about what is bookable.
 *
 * Public, like the rest of the catalogue: everything here is already on the
 * marketplace pages a signed-out visitor can read.
 */
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    // Only base services. An add-on is chosen against a booking that already
    // exists, so offering one as the answer to "what do you need?" would be
    // offering something that cannot be booked on its own.
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        kind: "SERVICE",
        providers: {
          some: { provider: { approvalStatus: "APPROVED", isAcceptingWork: true } },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        priceMinor: true,
        durationMinutes: true,
      },
    });

    // Browsing: the hub structure, built from what is actually bookable rather
    // than from a fixed list that could name an empty category.
    const categories = [...new Set(services.map((s) => s.category))].map(
      (name) => ({
        name,
        services: services.filter((service) => service.category === name),
      }),
    );

    if (query.length < 2) {
      return NextResponse.json({ query, matches: [], categories });
    }

    const matches = matchServices(query, services, MAX_MATCHES).map(
      (match) => ({ ...match.service, reason: match.reason }),
    );

    return NextResponse.json({ query, matches, categories });
  } catch (cause) {
    return errorResponse(cause);
  }
}
