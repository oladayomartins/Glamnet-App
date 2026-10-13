import { prisma } from "../prisma";
import { z } from "zod";
import { deliverApprovalEmail, deliverBookingNotice } from "../notifications";
import { AdminError, audit } from "./core";

/**
 * Vendors and accounts: vetting, suspension and promotion.
 *
 * A vendor's `approvalStatus` is what takes a storefront on or off the
 * marketplace; an account's `suspendedAt` is what locks a person out of
 * signing in at all. Suspending the account of a live vendor does both, so a
 * locked-out vendor cannot keep taking bookings they can no longer see.
 */

export type VendorDecision = "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING";

export async function decideVendor(
  actorEmail: string,
  providerId: string,
  decision: VendorDecision,
  note = "",
) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { _count: { select: { documents: true } }, appUser: { select: { suspendedAt: true } } },
  });
  if (!provider) throw new AdminError("That vendor no longer exists.", 404, "NOT_FOUND");

  if (decision === "APPROVED" && !provider.onboardedAt && provider.approvalStatus === "PENDING") {
    throw new AdminError("This vendor has not finished setting up their storefront yet.");
  }
  if (decision === "APPROVED" && provider.appUser?.suspendedAt) {
    throw new AdminError("This vendor's login is suspended. Reinstate the account on the Accounts page first.");
  }

  if (decision === "APPROVED" && provider._count.documents === 0) {
    throw new AdminError(
      "This vendor has not uploaded any insurance, licence or certificate yet.",
    );
  }
  if (decision === "SUSPENDED" && provider.approvalStatus !== "APPROVED") {
    throw new AdminError("Only a live vendor can be suspended. Reject an application instead.");
  }

  const now = new Date();
  const live = decision === "APPROVED";

  await prisma.$transaction(async (tx) => {
    // First approval signs off the documents on file; a suspension or
    // reinstatement leaves their review as it was.
    if (decision === "APPROVED" || decision === "REJECTED") {
      await tx.providerDocument.updateMany({
        where: { providerId, status: "PENDING" },
        data: { status: decision, reviewedAt: now, reviewNote: note },
      });
    }
    await tx.provider.update({
      where: { id: providerId },
      data: {
        approvalStatus: decision,
        approvedAt: live ? (provider.approvedAt ?? now) : decision === "SUSPENDED" ? provider.approvedAt : null,
        approvalNote: note,
        isAcceptingWork: live,
        isVerified: live,
        // A vendor taken offline stops being promoted too.
        ...(live ? {} : { isFeatured: false }),
      },
    });
  });

  await audit(
    actorEmail,
    `vendor.${decision.toLowerCase()}`,
    { type: "Provider", id: providerId },
    `${provider.name}${note ? ` — ${note}` : ""}`,
  );

  // Suspension has no email template of its own; the vendor sees the reason
  // on their dashboard. Approvals and rejections are what applicants wait on.
  if (decision === "APPROVED" || decision === "REJECTED") {
    await deliverApprovalEmail({ name: provider.name, email: provider.email, decision, note });
  }
}

export async function setVendorFeatured(actorEmail: string, providerId: string, featured: boolean) {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new AdminError("That vendor no longer exists.", 404, "NOT_FOUND");
  if (featured && provider.approvalStatus !== "APPROVED") {
    throw new AdminError("Only a live vendor can be featured.");
  }
  await prisma.provider.update({ where: { id: providerId }, data: { isFeatured: featured } });
  await audit(actorEmail, featured ? "vendor.feature" : "vendor.unfeature", { type: "Provider", id: providerId }, provider.name);
}

/**
 * The note an account suspension leaves on the storefront it takes offline.
 * Reinstating the account looks for it, so only a storefront that went
 * offline *because of* the account comes back — not one an admin suspended
 * on the Vendors page for reasons of its own.
 */
function accountSuspensionNote(reason: string): string {
  return reason ? `Account suspended: ${reason}` : "Account suspended.";
}

export async function setAccountSuspended(
  actorEmail: string,
  appUserId: string,
  suspend: boolean,
  reason = "",
) {
  const account = await prisma.appUser.findUnique({
    where: { id: appUserId },
    include: { provider: true },
  });
  if (!account) throw new AdminError("That account no longer exists.", 404, "NOT_FOUND");
  if (account.role === "ADMIN") {
    throw new AdminError("Admin access is set by the ADMIN_EMAILS list, not suspended here.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: appUserId },
      data: suspend
        ? { suspendedAt: new Date(), suspendedReason: reason }
        : { suspendedAt: null, suspendedReason: "" },
    });
    const vendor = account.provider;
    if (vendor && suspend && vendor.approvalStatus === "APPROVED") {
      await tx.provider.update({
        where: { id: vendor.id },
        data: {
          approvalStatus: "SUSPENDED",
          approvalNote: accountSuspensionNote(reason),
          isAcceptingWork: false,
          isVerified: false,
          isFeatured: false,
        },
      });
    }
    // Reinstating the account brings back a storefront that only went
    // offline because of the account suspension. Notes written before the
    // prefix existed were the bare reason, so that still matches.
    const suspendedByAccount =
      account.suspendedAt !== null &&
      [accountSuspensionNote(account.suspendedReason), account.suspendedReason || "Account suspended."].includes(
        vendor?.approvalNote ?? "",
      );
    if (vendor && !suspend && vendor.approvalStatus === "SUSPENDED" && suspendedByAccount) {
      await tx.provider.update({
        where: { id: vendor.id },
        data: { approvalStatus: "APPROVED", approvalNote: "", isAcceptingWork: true, isVerified: true },
      });
    }
  });

  await audit(
    actorEmail,
    suspend ? "account.suspend" : "account.reinstate",
    { type: "AppUser", id: appUserId },
    `${account.email}${reason ? ` — ${reason}` : ""}`,
  );
}

export const documentReviewInput = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  note: z.string().trim().max(500).default(""),
  expiresAt: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Not a valid date." });
        return z.NEVER;
      }
      return date;
    }),
});

/**
 * Review one document on its own: approve it, reject it with a reason the
 * vendor is emailed, or put it back to pending. Approving a vendor still
 * signs off every pending document at once; this is for the rest — a new
 * certificate on a live vendor, a blurry upload, an expiry date to record.
 */
export async function reviewDocument(actorEmail: string, providerId: string, documentId: string, raw: unknown) {
  const input = documentReviewInput.parse(raw);
  const document = await prisma.providerDocument.findFirst({
    where: { id: documentId, providerId },
    include: { provider: { select: { name: true, email: true } } },
  });
  if (!document) throw new AdminError("That document no longer exists.", 404, "NOT_FOUND");
  if (input.status === "REJECTED" && input.note.length < 5) {
    throw new AdminError("Say why the document was rejected — the vendor is emailed your note.", 422);
  }

  const updated = await prisma.providerDocument.update({
    where: { id: documentId },
    data: {
      status: input.status,
      reviewNote: input.note,
      reviewedAt: input.status === "PENDING" ? null : new Date(),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
  });

  await audit(
    actorEmail,
    `document.${input.status.toLowerCase()}`,
    { type: "Provider", id: providerId },
    `${document.provider.name}: ${document.kind}${document.fileName ? ` (${document.fileName})` : ""}${input.note ? ` — ${input.note}` : ""}`,
  );

  if (input.status === "REJECTED" && document.status !== "REJECTED") {
    await deliverBookingNotice({
      to: document.provider.email,
      name: document.provider.name,
      bookingId: "",
      path: "/provider/onboarding",
      subject: "A document needs replacing",
      heading: "Please upload a replacement document",
      lead: `We couldn't accept one of the documents on your GLAMNET storefront: ${input.note}`,
      facts: [["Document", document.fileName || document.kind]],
      cta: "Upload a new one",
    });
  }
  return updated;
}
