import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { emergencyConfigSchema } from "@/lib/api/schemas";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import { requireApiRole } from "@/lib/auth/api-guard";

/**
 * GET /api/admin/emergency-config — the config in force plus its history.
 *
 * Spec §5: the emergency threshold, surcharge type, amount, effective date and
 * active flag are all commercial parameters, changeable without a release.
 */
export async function GET() {
  try {
    // Pricing history is commercial information: admin only.
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const [active, history] = await Promise.all([
      getActiveEmergencyConfig(),
      prisma.emergencyPricingConfig.findMany({
        orderBy: { effectiveFrom: "desc" },
        take: 25,
      }),
    ]);
    return NextResponse.json({ active, history });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/emergency-config — publish new commercial terms.
 *
 * Config is append-only: a new row is inserted rather than the current one
 * edited, so every historic booking can still be explained against the terms
 * that priced it.
 */
export async function POST(request: Request) {
  try {
    // Commercial terms: admin only. Previously anyone could reprice the platform.
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const input = emergencyConfigSchema.parse(await request.json());
    const config = await prisma.emergencyPricingConfig.create({
      data: {
        thresholdMinutes: input.thresholdMinutes,
        surchargeType: input.surchargeType,
        surchargeValue: input.surchargeValue,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        isActive: input.isActive,
        note: input.note ?? "",
      },
    });
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
