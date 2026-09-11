import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { deliverApprovalEmail } from "@/lib/server/notifications";

const approvalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/providers/:id/approval — vet a provider application.
 *
 * Approving also opens them for work; rejecting closes it, so a rejected
 * application cannot keep receiving broadcasts through a stale flag.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { decision, note } = approvalSchema.parse(await request.json());

    const provider = await prisma.provider.update({
      where: { id },
      data: {
        approvalStatus: decision,
        approvedAt: decision === "APPROVED" ? new Date() : null,
        approvalNote: note ?? "",
        isAcceptingWork: decision === "APPROVED",
      },
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        approvedAt: true,
        isAcceptingWork: true,
      },
    });

    // A vetting decision is the one thing an applicant is waiting on, so it is
    // mailed rather than left for them to discover by signing in again.
    await deliverApprovalEmail({
      name: provider.name,
      email: provider.email,
      decision,
      note: note ?? "",
    });

    return NextResponse.json({ provider });
  } catch (error) {
    return errorResponse(error);
  }
}
