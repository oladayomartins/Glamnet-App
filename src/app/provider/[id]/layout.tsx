import { cookies } from "next/headers";
import { VendorShell } from "./vendor-shell";
import { SetupBanner } from "./setup-banner";
import { getSessionUser } from "@/lib/auth/session";
import { vendorSetup } from "@/lib/server/provider-portal";
import { heldPayoutSummary } from "@/lib/server/held-payouts";
import { setupBannerCookie } from "@/lib/domain/vendor-setup";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/server/prisma";

/**
 * The vendor app shell around every /provider/:id page: tabs, the request
 * badge and pull-to-refresh — and, until the vendor is verified, the setup
 * banner at the top of every page.
 *
 * Its `data-vendor-app` marker hides the customer site footer (see
 * globals.css): links like "Book a service" are clutter to someone running
 * their business here.
 */
export default async function VendorLayout({
  children,
  params,
}: LayoutProps<"/provider/[id]">) {
  const { id } = await params;

  return (
    <VendorShell providerId={id} banner={await setupBannerFor(id)}>
      {children}
    </VendorShell>
  );
}

/**
 * The banner, for the vendor themselves (or an admin looking over their
 * shoulder). Nothing once they're verified with nothing held. The pages
 * enforce access; this only decides whether there's anything to show.
 */
async function setupBannerFor(providerId: string) {
  const viewer = await getSessionUser();
  if (!viewer || (viewer.role !== "ADMIN" && viewer.providerId !== providerId)) return null;

  const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { onboardedAt: true } });
  if (!provider) return null;
  const [setup, held, jar] = await Promise.all([vendorSetup(providerId), heldPayoutSummary(providerId), cookies()]);
  if (setup.verified && held.totalMinor === 0) return null;

  return (
    <SetupBanner
      providerId={providerId}
      percent={setup.percent}
      live={provider.onboardedAt !== null}
      readyForApproval={setup.readyForApproval}
      missing={setup.items
        .filter((item) => !item.done && item.key !== "approval")
        .map(({ key, label, step, requiredToList }) => ({ key, label, step, requiredToList }))}
      heldLabel={held.totalMinor > 0 ? formatMoney(held.totalMinor) : null}
      // Collapsed only at the percentage it was collapsed at: progress reopens it.
      initiallyCollapsed={jar.get(setupBannerCookie(providerId))?.value === String(setup.percent)}
    />
  );
}
