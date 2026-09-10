import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { buildEmergencyReport } from "@/lib/server/reporting";
import { requireApiRole } from "@/lib/auth/api-guard";

/** GET /api/admin/reports — the emergency performance figures (spec §10). */
export async function GET() {
  try {
    // Commercial reporting.
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const report = await buildEmergencyReport();
    return NextResponse.json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}
