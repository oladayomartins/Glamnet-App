import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/auth/session";
import { accountDetail } from "@/lib/server/admin/account-detail";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { signedFileUrl } from "@/lib/server/private-files";
import { Stat } from "../../_components/bits";
import { ActivityList } from "../../_components/activity-list";
import { BookingTable } from "../../_components/booking-table";
import { DocumentReview } from "../../_components/document-review";
import { AccountActions } from "./account-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Account" };

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const day = (value: Date | null | undefined) => (value ? DAY.format(value) : "—");

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ink">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One person: their login, their customer side, their vendor side, their
 * bookings and every admin action taken on them.
 */
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN", `/admin/accounts/${id}`);
  const detail = await accountDetail(id);
  if (!detail) notFound();

  const { login, customer, provider, asCustomer, asVendor } = detail;
  const name = provider?.name || customer?.name || login?.email.split("@")[0] || "Unknown";
  const email = login?.email ?? provider?.email ?? customer?.email ?? "";
  const vendorLive = provider?.approvalStatus === "APPROVED";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/accounts" className="tap-44 text-sm text-ink-muted hover:text-accent-700">
          ← Accounts
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{name}</h1>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">{email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {login ? <Pill tone={login.role === "ADMIN" ? "positive" : "neutral"}>{login.role.toLowerCase()}</Pill> : <Pill>no login</Pill>}
              {customer ? <Pill>customer</Pill> : null}
              {provider ? (
                <Pill tone={vendorLive ? "positive" : provider.approvalStatus === "PENDING" ? "neutral" : "muted"}>
                  vendor {provider.approvalStatus.toLowerCase()}
                </Pill>
              ) : null}
              {provider?.isFeatured ? <Pill tone="positive">featured</Pill> : null}
              {login?.suspendedAt ? <Pill tone="muted">suspended</Pill> : null}
              {login?.marketingOptOutAt ? <Pill>no marketing email</Pill> : null}
            </div>
            {login?.suspendedAt ? (
              <p className="mt-2 text-sm text-warning">
                Suspended {day(login.suspendedAt)}
                {login.suspendedReason ? ` — ${login.suspendedReason}` : ""}
              </p>
            ) : null}
          </div>
          <AccountActions
            appUserId={login?.id ?? null}
            email={email}
            isAdmin={login?.role === "ADMIN"}
            suspended={Boolean(login?.suspendedAt)}
            vendor={provider ? { id: provider.id, live: vendorLive, featured: provider.isFeatured } : null}
          />
        </div>
      </div>

      <Card className="p-4">
        <SectionTitle>Login</SectionTitle>
        <Facts
          rows={[
            ["Signed up", day(login?.createdAt ?? provider?.createdAt ?? customer?.createdAt)],
            ["Account id", <span key="id" className="font-mono text-xs">{login?.id ?? "No login"}</span>],
            ["Push devices", login ? String(login._count.pushSubscriptions) : "—"],
            ["Marketing email", login ? (login.marketingOptOutAt ? `Opted out ${day(login.marketingOptOutAt)}` : "Subscribed") : "—"],
          ]}
        />
      </Card>

      {provider && asVendor ? (
        <section className="space-y-4">
          <SectionTitle
            hint={
              <span className="flex flex-wrap gap-3">
                <Link href={`/admin/providers?status=${provider.approvalStatus}&q=${encodeURIComponent(provider.email)}`} className="hover:text-accent-700">
                  Vetting controls →
                </Link>
                {provider.slug ? (
                  <a href={`/pro/${provider.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent-700">
                    Storefront <ArrowSquareOut size={12} aria-hidden />
                  </a>
                ) : null}
              </span>
            }
          >
            As a vendor
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Bookings" value={String(asVendor.total)} hint={`${asVendor.upcoming} upcoming · ${asVendor.completed} done`} />
            <Stat label="Booking value" value={formatMoney(asVendor.valueMinor)} hint={`${formatMoney(asVendor.payoutMinor)} to them`} />
            <Stat label="Commission" value={formatMoney(asVendor.commissionMinor)} tone="gold" />
            <Stat
              label="Rating"
              value={asVendor.averageRating ? asVendor.averageRating.toFixed(1) : "—"}
              hint={`${asVendor.ratings} rating${asVendor.ratings === 1 ? "" : "s"}`}
            />
            <Stat label="Cancelled" value={String(asVendor.cancelled)} hint={`${asVendor.noShows} no-show${asVendor.noShows === 1 ? "" : "s"}`} />
            <Stat label="Disputes" value={String(asVendor.disputes)} tone={asVendor.disputes ? "warning" : undefined} />
            <Stat label="Refunded" value={formatMoney(asVendor.refundedMinor)} />
            <Stat label="Saved by" value={String(provider._count.savedBy)} hint="customers" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle>Storefront</SectionTitle>
              <Facts
                rows={[
                  ["Link", provider.slug ? `/pro/${provider.slug}` : "Not chosen yet"],
                  ["Area", `${provider.hub.name} · ${provider.hub.sector}, ${provider.hub.city}`],
                  ["Workspace", `${provider.workspaceType.replaceAll("_", " ").toLowerCase()}${provider.travelsToClients ? " · travels to clients" : ""}`],
                  ["Phone", provider.phone],
                  ["Instagram", provider.instagramHandle ? `@${provider.instagramHandle.replace(/^@/, "")}` : ""],
                  ["Accepting work", provider.isAcceptingWork ? "Yes" : "No"],
                  ["Lookbook", `${provider._count.lookbook} photo${provider._count.lookbook === 1 ? "" : "s"}`],
                  ["Opening hours", provider._count.availability > 0 ? "Set" : "Not set"],
                ]}
              />
            </Card>
            <Card className="p-4">
              <SectionTitle>Vetting and payouts</SectionTitle>
              <Facts
                rows={[
                  ["Status", provider.approvalStatus.toLowerCase()],
                  ["Application sent", day(provider.onboardedAt)],
                  ["Approved", day(provider.approvedAt)],
                  ["Note", provider.approvalNote],
                  ["Stripe account", provider.stripeAccountId ? <span key="s" className="font-mono text-xs">{provider.stripeAccountId}</span> : "Not connected"],
                  ["Payouts", provider.payoutsEnabled ? "Enabled" : "Not enabled — can't be paid yet"],
                ]}
              />
            </Card>
          </div>

          <div>
            <SectionTitle>Documents</SectionTitle>
            <DocumentReview
              providerId={provider.id}
              documents={provider.documents.map((doc) => ({
                id: doc.id,
                kind: doc.kind,
                fileName: doc.fileName,
                url: signedFileUrl(doc.url),
                status: doc.status,
                reviewNote: doc.reviewNote,
                uploadedAt: doc.uploadedAt.toISOString(),
                reviewedAt: doc.reviewedAt?.toISOString() ?? null,
                expiresAt: doc.expiresAt?.toISOString() ?? null,
              }))}
            />
          </div>

          <div>
            <SectionTitle hint={`${provider.services.length} on the menu`}>Services</SectionTitle>
            {provider.services.length === 0 ? (
              <p className="text-sm text-ink-muted">No services on the menu yet.</p>
            ) : (
              <Card className="divide-y divide-line">
                {provider.services.map((row) => (
                  <div key={row.serviceId} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2 text-sm">
                    <span className="font-medium text-ink">{row.service.name}</span>
                    <span className="text-xs text-ink-muted">{row.service.category}</span>
                    {row.isFeatured ? <Pill tone="positive">pinned</Pill> : null}
                    <span data-numeric className="ml-auto tabular-nums text-ink">
                      {formatMoney(row.priceMinor ?? row.service.priceMinor)}
                      {row.priceMinor !== null && row.priceMinor !== row.service.priceMinor ? (
                        <span className="ml-1 text-xs text-ink-muted">(list {formatMoney(row.service.priceMinor)})</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <SectionTitle hint={asVendor.total > detail.vendorBookings.length ? `latest ${detail.vendorBookings.length} of ${asVendor.total}` : undefined}>
              Bookings they took
            </SectionTitle>
            <BookingTable bookings={detail.vendorBookings} side="vendor" empty="No bookings yet." />
          </div>
        </section>
      ) : null}

      {customer && asCustomer ? (
        <section className="space-y-4">
          <SectionTitle>As a customer</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Bookings" value={String(asCustomer.total)} hint={`${asCustomer.upcoming} upcoming · ${asCustomer.completed} done`} />
            <Stat label="Spent" value={formatMoney(asCustomer.valueMinor)} tone="gold" />
            <Stat label="Cancelled" value={String(asCustomer.cancelled)} hint={`${asCustomer.noShows} no-show${asCustomer.noShows === 1 ? "" : "s"}`} />
            <Stat label="Disputes" value={String(asCustomer.disputes)} tone={asCustomer.disputes ? "warning" : undefined} hint={`${formatMoney(asCustomer.refundedMinor)} refunded`} />
          </div>
          <Card className="p-4">
            <Facts
              rows={[
                ["Phone", customer.phone],
                ["Postcode", customer.postcode],
                ["Saved vendors", String(customer._count.saved)],
                ["Card on file", customer.stripeCustomerId ? "Yes" : "No"],
                [
                  "Promo codes used",
                  detail.promoUses.length === 0
                    ? "None"
                    : detail.promoUses.map((use) => `${use.promoCode.code} (−${formatMoney(use.discountMinor)})`).join(", "),
                ],
              ]}
            />
          </Card>
          <div>
            <SectionTitle hint={asCustomer.total > detail.customerBookings.length ? `latest ${detail.customerBookings.length} of ${asCustomer.total}` : undefined}>
              Bookings they made
            </SectionTitle>
            <BookingTable bookings={detail.customerBookings} side="customer" empty="No bookings yet." />
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>Admin history</SectionTitle>
        <ActivityList entries={detail.history} />
      </section>
    </div>
  );
}
