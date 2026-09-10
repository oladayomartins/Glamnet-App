import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { buildEmergencyReport } from "@/lib/server/reporting";

/** GET /api/admin/reports — the emergency performance figures (spec §10). */
export async function GET() {
  try {
    const report = await buildEmergencyReport();
    return NextResponse.json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}
