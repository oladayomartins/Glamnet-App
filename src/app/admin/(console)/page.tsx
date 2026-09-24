import Link from "next/link";
import {
  ArrowRight,
  Megaphone,
  Scales,
  Storefront,
  Television,
} from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { overviewStats } from "@/lib/server/admin/insights";
import { formatMoney } from "@/lib/domain/pricing";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { AdminHeader, Stat } from "./_components/bits";
import { ActivityList } from "./_components/activity-list";

export const dynamic = "force-dynamic";

/** Admin overview: the numbers that matter today and what needs a decision. */
export default async function AdminOverviewPage() {
  await requireRole("ADMIN", "/admin");
  const [stats, recent] = await Promise.all([
    overviewStats(),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const attention = [
    stats.pendingVendors > 0 && {
      href: "/admin/providers?status=PENDING",
      icon: Storefront,
      text: `${stats.pendingVendors} vendor application${stats.pendingVendors === 1 ? "" : "s"} waiting for review`,
    },
    stats.openDisputes > 0 && {
      href: "/admin/bookings?filter=DISPUTED",
      icon: Scales,
      text: `${stats.openDisputes} disputed booking${stats.openDisputes === 1 ? "" : "s"} to resolve`,
    },
  ].filter(Boolean) as { href: string; icon: typeof Storefront; text: string }[];

  return (
    <div className="space-y-8">
      <AdminHeader title="Overview" lede="How GLAMNET is doing this month, and anything that needs a decision." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bookings this month" value={String(stats.bookingsThisMonth)} />
        <Stat label="Booking value this month" value={formatMoney(stats.gmvThisMonthMinor)} />
        <Stat label="Commission earned" value={formatMoney(stats.commissionThisMonthMinor)} tone="gold" />
        <Stat label="Open disputes" value={String(stats.openDisputes)} tone={stats.openDisputes ? "warning" : undefined} />
        <Stat label="Live vendors" value={String(stats.liveVendors)} hint={`${stats.suspendedVendors} suspended`} />
        <Stat label="Awaiting review" value={String(stats.pendingVendors)} tone={stats.pendingVendors ? "warning" : undefined} />
        <Stat label="Customer accounts" value={String(stats.customers)} hint={`${stats.suspendedAccounts} accounts suspended`} />
        <Stat label="Card holds pending" value={String(stats.awaitingPayment)} hint="Checkouts not yet authorised" />
      </section>

      <section>
        <SectionTitle>Needs attention</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState>Nothing waiting on you. New applications and disputes show up here.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {attention.map(({ href, icon: Icon, text }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-glam border border-accent-500/40 bg-surface p-4 text-sm text-ink transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-card"
                >
                  <Icon size={20} className="text-accent-700" aria-hidden />
                  <span className="flex-1">{text}</span>
                  <ArrowRight size={14} className="text-accent-700 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-4">
          <Megaphone size={24} className="text-accent-700" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">{stats.liveCampaigns} live campaign{stats.liveCampaigns === 1 ? "" : "s"}</p>
            <p className="text-xs text-ink-muted">Site banners and email</p>
          </div>
          <Link href="/admin/campaigns" className="text-sm font-semibold text-accent-700 hover:underline">
            Manage
          </Link>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <Television size={24} className="text-accent-700" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">{stats.liveAds} live ad{stats.liveAds === 1 ? "" : "s"}</p>
            <p className="text-xs text-ink-muted">Home, directory and storefront slots</p>
          </div>
          <Link href="/admin/ads" className="text-sm font-semibold text-accent-700 hover:underline">
            Manage
          </Link>
        </Card>
      </section>

      <section>
        <SectionTitle hint={<Link href="/admin/activity" className="hover:text-accent-700">See all →</Link>}>
          Recent admin activity
        </SectionTitle>
        <ActivityList entries={recent} />
      </section>
    </div>
  );
}
