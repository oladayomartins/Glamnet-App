import { NextResponse } from "next/server";
import { recordStorefrontView } from "@/lib/server/storefront-stats";

export const dynamic = "force-dynamic";

/**
 * POST /api/pro/:slug/view?source=link|directory — count one storefront view
 * for the vendor's stats. Sent once by the page after it loads. Always 204:
 * a lost count is not worth an error in a visitor's console.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = new URL(request.url).searchParams.get("source") === "directory" ? "MARKETPLACE" : "DIRECT_LINK";
  await recordStorefrontView(slug, source, request.headers.get("user-agent")).catch((cause) =>
    console.error("[storefront-stats] view count failed", cause),
  );
  return new NextResponse(null, { status: 204 });
}
