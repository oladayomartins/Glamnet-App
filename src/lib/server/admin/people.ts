import { prisma } from "../prisma";
import { deliverApprovalEmail } from "../notifications";
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
