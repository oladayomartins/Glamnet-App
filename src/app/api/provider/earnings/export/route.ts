import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { vendorLedger } from "@/lib/server/vendor-ledger";
import { exportFileName, ledgerCsv, parsePeriod, periodRange } from "@/lib/domain/ledger";

export const dynamic = "force-dynamic";

/**
 * GET /api/provider/earnings/export?period=30|7|90|tax|lasttax — the signed-in
 * vendor's earnings as a CSV, for their bookkeeping or tax return. The same
 * rows and totals as the earnings page.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const period = parsePeriod(new URL(request.url).searchParams.get("period"));
    const now = new Date();
    const range = periodRange(period, now);
    const rows = await vendorLedger(auth.providerId, range.from, range.to);
    return new NextResponse(ledgerCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(period, now)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
