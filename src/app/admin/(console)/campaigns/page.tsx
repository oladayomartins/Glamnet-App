import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { scheduleOf } from "@/lib/server/admin/core";
import { AdminHeader } from "../_components/bits";
import { CampaignManager } from "./campaign-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaigns" };

/** Announcements shown on the site, and emails to customers or vendors. */
export default async function AdminCampaignsPage() {
  await requireRole("ADMIN", "/admin/campaigns");
  const [campaigns, reachable, optedOut] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    // Counted, not listed: the same rule as campaignRecipients(), without
    // reading every address on the platform to measure an audience.
    prisma.appUser.groupBy({
      by: ["role"],
      where: { role: { in: ["CUSTOMER", "PROVIDER"] }, suspendedAt: null, marketingOptOutAt: null },
      _count: true,
    }),
    prisma.appUser.count({ where: { marketingOptOutAt: { not: null } } }),
  ]);
  const customers = reachable.find((row) => row.role === "CUSTOMER")?._count ?? 0;
  const vendors = reachable.find((row) => row.role === "PROVIDER")?._count ?? 0;

  return (
    <div>
      <AdminHeader
        title="Campaigns"
        lede={`Put an announcement banner on the site for a set period, email it to your customers or vendors, or both. Each campaign can be emailed once. Every email carries an unsubscribe link; ${optedOut} ${optedOut === 1 ? "person has" : "people have"} opted out and won't be emailed.`}
      />
      <CampaignManager
        audienceSizes={{ ALL: customers + vendors, CUSTOMERS: customers, VENDORS: vendors }}
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
