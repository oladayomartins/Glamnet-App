import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { deliverApprovalEmail } from "@/lib/server/notifications";
import { BookingError } from "@/lib/server/booking-service";

const approvalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/providers/:id/approval — vet a vendor application.
 *
 * Approving also opens them for work; rejecting closes it, so a rejected
 * application cannot keep receiving broadcasts through a stale flag.
 *
 * Approval is the compliance gate (Directory §C): it needs at least one
 * insurance certificate or licence on file, and approves those documents
 * with it. That is what sets `isVerified` and puts the storefront live.
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

    const documents = await prisma.providerDocument.count({ where: { providerId: id } });
    if (decision === "APPROVED" && documents === 0) {
      throw new BookingError(
        "This vendor has not uploaded any insurance or licence documents yet.",
        "INVALID_TRANSITION",
        409,
      );
    }

    const now = new Date();
    if (decision !== "PENDING") {
      await prisma.providerDocument.updateMany({
        where: { providerId: id, status: "PENDING" },
        data: { status: decision, reviewedAt: now, reviewNote: note ?? "" },
      });
    }

    const provider = await prisma.provider.update({
      where: { id },
      data: {
        approvalStatus: decision,
        approvedAt: decision === "APPROVED" ? now : null,
        approvalNote: note ?? "",
        isAcceptingWork: decision === "APPROVED",
        isVerified: decision === "APPROVED",
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
