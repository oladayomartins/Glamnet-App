import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/auth/session";
import { financeSummary } from "@/lib/server/admin/insights";
import { RANGES, resolveRange, type RangeKey } from "@/lib/server/admin/ranges";
import { formatMoney } from "@/lib/domain/pricing";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { AdminHeader, Stat } from "../_components/bits";

export const dynamic = "force-dynamic";

export const metadata = { title: "Finance" };

const SOURCE_LABEL: Record<string, string> = {
  DIRECT_LINK: "Bio link (0%)",
  MARKETPLACE: "Marketplace",
  BROADCAST: "Broadcast requests",
};

/** Money through the platform: takings, commission, escrow and payouts. */
export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireRole("ADMIN", "/admin/finance");
  const range = resolveRange((await searchParams).range);
  const summary = await financeSummary(range);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Finance"
        lede="What clients paid, what GLAMNET kept, and what went to vendors. Cancelled bookings are left out."
        action={
          <a
            href={`/api/admin/finance/export?range=${range.key}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-sunken"
          >
            <DownloadSimple size={16} aria-hidden /> Export CSV
          </a>
        }
      />

      <nav aria-label="Period" className="flex flex-wrap gap-1.5">
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={`/admin/finance?range=${key}`}
            aria-current={range.key === key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium transition ${
              range.key === key ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {RANGES[key]}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Booking value" value={formatMoney(summary.gmvMinor)} hint={`${summary.bookings} bookings`} />
        <Stat
          label="GLAMNET commission"
          value={formatMoney(summary.commissionMinor)}
          tone="gold"
          hint={summary.discountsMinor ? `less ${formatMoney(summary.discountsMinor)} promo discounts` : undefined}
        />
        <Stat label="Card fees collected" value={formatMoney(summary.processingFeesMinor)} hint="2% card processing" />
        <Stat label="Trust fees" value={formatMoney(summary.trustFeesMinor)} />
        <Stat label="Owed to vendors" value={formatMoney(summary.vendorPayoutsMinor)} hint={`incl. ${formatMoney(summary.tipsMinor)} tips`} />
        <Stat label="Paid out to vendors" value={formatMoney(summary.released.amountMinor)} hint={`${summary.released.bookings} released by PIN`} />
        <Stat label="Held in escrow now" value={formatMoney(summary.escrowHeld.amountMinor)} hint={`${summary.escrowHeld.bookings} card holds`} />
        <Stat
          label="Under dispute now"
          value={formatMoney(summary.disputed.amountMinor)}
          hint={`${summary.disputed.bookings} bookings`}
          tone={summary.disputed.bookings ? "warning" : undefined}
        />
      </section>

      <section>
        <SectionTitle>Where bookings came from</SectionTitle>
        {summary.bySource.length === 0 ? (
          <EmptyState>No bookings in this period.</EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {summary.bySource.map((row) => (
              <div key={row.source} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3 text-sm">
                <span className="flex-1 font-medium text-ink">{SOURCE_LABEL[row.source] ?? row.source}</span>
                <span className="text-ink-muted">{row.bookings} bookings</span>
                <span data-numeric className="font-mono text-ink">{formatMoney(row.gmvMinor)}</span>
                <span data-numeric className="w-28 text-right font-mono font-semibold text-accent-700">
                  {formatMoney(row.commissionMinor)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle hint="Top 25 by booking value">Vendors</SectionTitle>
        {summary.vendors.length === 0 ? (
          <EmptyState>No vendor earnings in this period.</EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bookings</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Commission</th>
                  <th className="px-4 py-2.5 text-right font-medium">Vendor payout</th>
                  <th className="px-4 py-2.5 font-medium">Bank</th>
                </tr>
              </thead>
              <tbody>
                {summary.vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {vendor.slug ? (
                        <Link href={`/pro/${vendor.slug}`} className="hover:text-accent-700">
                          {vendor.name}
                        </Link>
                      ) : (
                        vendor.name
                      )}
                    </td>
                    <td data-numeric className="px-4 py-2.5 text-right font-mono">{vendor.bookings}</td>
                    <td data-numeric className="px-4 py-2.5 text-right font-mono">{formatMoney(vendor.gmvMinor)}</td>
                    <td data-numeric className="px-4 py-2.5 text-right font-mono text-accent-700">{formatMoney(vendor.commissionMinor)}</td>
                    <td data-numeric className="px-4 py-2.5 text-right font-mono font-semibold">{formatMoney(vendor.payoutMinor)}</td>
                    <td className={`px-4 py-2.5 text-xs ${vendor.payoutsEnabled ? "text-normal-ink" : "text-warning"}`}>
                      {vendor.payoutsEnabled ? "Linked" : "Not linked"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
