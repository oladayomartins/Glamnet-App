import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { pushToUsers } from "./push";
import { heldPayoutSummary } from "./held-payouts";
import { setupProgress } from "@/lib/domain/vendor-setup";
import { MAX_REMINDERS, setupReminderDue } from "@/lib/domain/setup-reminders";
import { vendorSetupReminderEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/domain/pricing";
import { siteUrl } from "@/lib/site";

/**
 * The daily setup reminders, run by the settlements cron: every vendor not
 * yet verified, listed or not, who still has steps to do and is due one (see
 * lib/domain/setup-reminders.ts). Email always; a push too where they've
 * turned notifications on. One vendor's failure never stops the rest.
 */
export async function sendSetupReminders(now = new Date()): Promise<{ checked: number; sent: number; failed: number }> {
  const vendors = await prisma.provider.findMany({
    where: {
      approvalStatus: "PENDING",
      setupRemindersSent: { lt: MAX_REMINDERS },
      // A locked-out account gets no nudges to finish anything.
      OR: [{ appUserId: null }, { appUser: { suspendedAt: null } }],
    },
    include: {
      _count: {
        select: {
          services: true,
          availability: true,
          lookbook: true,
          documents: { where: { status: { not: "REJECTED" } } },
        },
      },
    },
  });

  const totals = { checked: vendors.length, sent: 0, failed: 0 };
  const url = `${siteUrl()}/provider/onboarding?step=review`;

  for (const vendor of vendors) {
    const setup = setupProgress({
      name: vendor.name,
      avatarUrl: vendor.avatarUrl,
      slug: vendor.slug,
      bio: vendor.bio,
      workspaceType: vendor.workspaceType,
      workspaceSector: vendor.workspaceSector,
      workspaceAddress: vendor.workspaceAddress,
      serviceCount: vendor._count.services,
      availabilityCount: vendor._count.availability,
      lookbookCount: vendor._count.lookbook,
      documentCount: vendor._count.documents,
      payoutsEnabled: vendor.payoutsEnabled,
      approvalStatus: vendor.approvalStatus,
    });
    const due = setupReminderDue({
      startedAt: vendor.onboardedAt ?? vendor.createdAt,
      lastSentAt: vendor.setupReminderSentAt,
      sentCount: vendor.setupRemindersSent,
      verified: setup.verified,
      readyForApproval: setup.readyForApproval,
      now,
    });
    if (!due) continue;

    try {
      // Claim it first, so an overlapping run can't send the same reminder twice.
      const claimed = await prisma.provider.updateMany({
        where: { id: vendor.id, setupRemindersSent: vendor.setupRemindersSent },
        data: { setupReminderSentAt: now, setupRemindersSent: { increment: 1 } },
      });
      if (claimed.count === 0) continue;

      const live = vendor.onboardedAt !== null;
      const held = await heldPayoutSummary(vendor.id);
      const missing = setup.items.filter((item) => !item.done && item.key !== "approval").map((item) => item.label);
      const firstName = vendor.name.trim().split(/\s+/)[0] || "there";
      const heldLabel = held.totalMinor > 0 ? formatMoney(held.totalMinor) : null;

      const result = await sendEmail({
        to: vendor.email,
        ...vendorSetupReminderEmail({ name: firstName, percent: setup.percent, live, missing, heldLabel, url }),
      });
      if (!result.ok) {
        // Not sent: hand the claim back so tomorrow's run tries again.
        await prisma.provider.update({
          where: { id: vendor.id },
          data: { setupReminderSentAt: vendor.setupReminderSentAt, setupRemindersSent: vendor.setupRemindersSent },
        });
        totals.failed += 1;
        continue;
      }
      if (vendor.appUserId) {
        await pushToUsers([vendor.appUserId], {
          title: `Your storefront is ${setup.percent}% set up`,
          body: heldLabel
            ? `${heldLabel} is waiting for you. Finish ${missing.length === 1 ? "the last step" : `${missing.length} steps`} to get verified and paid.`
            : `${missing.length === 1 ? "One step" : `${missing.length} steps`} left to ${live ? "get your verified badge" : "go live"}.`,
          url: "/provider/onboarding?step=review",
          tag: "setup-reminder",
        }).catch(() => 0);
      }
      totals.sent += 1;
    } catch (error) {
      totals.failed += 1;
      console.error(`sendSetupReminders: vendor ${vendor.id}`, error);
    }
  }
  return totals;
}
