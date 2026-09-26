import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { campaignRecipients } from "@/lib/server/admin/marketing";
import { scheduleOf } from "@/lib/server/admin/core";
import { AdminHeader } from "../_components/bits";
import { CampaignManager } from "./campaign-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaigns" };

/** Announcements shown on the site, and emails to customers or vendors. */
export default async function AdminCampaignsPage() {
  await requireRole("ADMIN", "/admin/campaigns");
  const [campaigns, all, customers, vendors, optedOut] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    campaignRecipients("ALL"),
    campaignRecipients("CUSTOMERS"),
    campaignRecipients("VENDORS"),
    prisma.appUser.count({ where: { marketingOptOutAt: { not: null } } }),
  ]);

  return (
    <div>
      <AdminHeader
        title="Campaigns"
        lede={`Put an announcement banner on the site for a set period, email it to your customers or vendors, or both. Each campaign can be emailed once. Every email carries an unsubscribe link; ${optedOut} ${optedOut === 1 ? "person has" : "people have"} opted out and won't be emailed.`}
      />
      <CampaignManager
        audienceSizes={{ ALL: all.length, CUSTOMERS: customers.length, VENDORS: vendors.length }}
        emailReady={Boolean(process.env.RESEND_API_KEY)}
        campaigns={campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          audience: campaign.audience as "ALL" | "CUSTOMERS" | "VENDORS",
          title: campaign.title,
          message: campaign.message,
          ctaLabel: campaign.ctaLabel,
          ctaUrl: campaign.ctaUrl,
          showBanner: campaign.showBanner,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt?.toISOString() ?? null,
          isActive: campaign.isActive,
          schedule: scheduleOf(campaign),
          emailSentAt: campaign.emailSentAt?.toISOString() ?? null,
          emailSentTo: campaign.emailSentTo,
        }))}
      />
    </div>
  );
}
