import { NextResponse } from "next/server";
import { adReportCsv } from "@/lib/domain/ad-report";
import { adReportByToken } from "@/lib/server/ad-report";

export const dynamic = "force-dynamic";

/** GET /ad-report/:token/csv — the shared report as a spreadsheet. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await adReportByToken(token);
  if (!shared) return new NextResponse("Not found", { status: 404 });
  const slug = shared.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ad";
  return new NextResponse(adReportCsv(shared.report, shared.name), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-report-${shared.report.to}.csv"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
