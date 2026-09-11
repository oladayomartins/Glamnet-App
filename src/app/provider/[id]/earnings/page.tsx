import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Receipt } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  BookingTypeTag,
  Card,
  EmptyState,
  SectionTitle,
} from "@/components/ui";
import { formatDay, formatMoney, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Periods the ledger can be read over. */
const PERIODS = {
  "7": { label: "Last 7 days", days: 7 },
  "30": { label: "Last 30 days", days: 30 },
  "90": { label: "Last 90 days", days: 90 },
} as const;

type PeriodKey = keyof typeof PERIODS;

/** A booking counts towards earnings once the work is done, not when accepted. */
const EARNED_STATUSES = ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"];

/**
 * The provider earnings ledger (§P-06).
 *
 * Normal and emergency are reported separately, because the two are different
 * businesses to the provider: emergency work pays more per hour and costs more
 * in disruption, and a single blended figure hides both facts. Every emergency
 * row carries the type tag for the same reason.
 */
export default async function EarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ id }, { period: rawPeriod }] = await Promise.all([
    params,
    searchParams,
  ]);

  // Earnings are the provider's own business and nobody else's.
  const viewer = await requireUser(`/provider/${id}/earnings`);
  if (viewer.role !== "ADMIN" && viewer.providerId !== id) redirect("/forbidden");

  const period: PeriodKey =
    rawPeriod === "7" || rawPeriod === "30" || rawPeriod === "90"
      ? rawPeriod
      : "30";

  const since = new Date();
  since.setDate(since.getDate() - PERIODS[period].days);

  const [provider, bookings] = await Promise.all([
    prisma.provider.findUnique({
      where: { id },
      select: { id: true, name: true },
    }),
    prisma.booking.findMany({
      where: {
        providerId: id,
        status: { in: EARNED_STATUSES },
        appointmentStartAt: { gte: since },
      },
      orderBy: { appointmentStartAt: "desc" },
      include: { items: { select: { name: true } } },
    }),
  ]);

  if (!provider) notFound();

  const rows = bookings.map((booking) => {
    // The platform's cut is whatever the customer paid less what the provider
    // takes: commission on the service work plus the unshared trust fee.
    const feeMinor =
      booking.totalInvoicePriceMinor - booking.providerEarningsMinor;

    return {
      id: booking.id,
      bookingType: booking.bookingType,
      startAt: booking.appointmentStartAt,
      services: booking.items.map((item) => item.name).join(" + "),
      grossMinor: booking.totalInvoicePriceMinor,
      surgeMinor: booking.providerEmergencyEarningsMinor,
      feeMinor,
      netMinor: booking.providerEarningsMinor,
    };
  });

  const emergencyRows = rows.filter((row) => row.bookingType === "EMERGENCY");
  const normalRows = rows.filter((row) => row.bookingType !== "EMERGENCY");
  const sumNet = (entries: typeof rows) =>
    entries.reduce((total, row) => total + row.netMinor, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/provider/${provider.id}`}
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          Earnings
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {provider.name} · completed work only
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Period">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <Link
            key={key}
            href={`/provider/${provider.id}/earnings?period=${key}`}
            aria-current={period === key ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ease-glam ${
              period === key
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {PERIODS[key].label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Summary label="Total net" value={formatMoney(sumNet(rows))} count={rows.length} />
        <Summary
          label="Normal"
          value={formatMoney(sumNet(normalRows))}
          count={normalRows.length}
        />
        <Summary
          label="Emergency"
          value={formatMoney(sumNet(emergencyRows))}
          count={emergencyRows.length}
          tone="emergency"
        />
      </div>

      <section>
        <SectionTitle hint={`${rows.length} jobs`}>Completed jobs</SectionTitle>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt size={24} weight="light" />}
            title="Nothing earned in this period"
            action={
              <Link
                href={`/provider/${provider.id}`}
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                Back to requests
              </Link>
            }
          >
            A job appears here once you have marked it complete.
          </EmptyState>
        ) : (
          // The ledger is denser than the customer app is allowed to be; that
          // is deliberate, and it is the one place 13px is acceptable.
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Date</Th>
                  <Th>Ref</Th>
                  <Th>Services</Th>
                  <Th numeric>Gross</Th>
                  <Th numeric>Surge</Th>
                  <Th numeric>Fee</Th>
                  <Th numeric>Net</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line/70 last:border-0"
                  >
                    <Td>
                      <Link
                        href={`/bookings/${row.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {formatDay(row.startAt)} {formatTime(row.startAt)}
                      </Link>
                      {row.bookingType === "EMERGENCY" ? (
                        <span className="ml-2 align-middle">
                          <BookingTypeTag bookingType="EMERGENCY" size="sm" />
                        </span>
                      ) : null}
                    </Td>
                    <Td mono>{row.id.slice(-8)}</Td>
                    <Td>
                      <span className="text-ink-muted">{row.services}</span>
                    </Td>
                    <Td mono numeric>
                      {formatMoney(row.grossMinor)}
                    </Td>
                    <Td mono numeric emphasis={row.surgeMinor > 0}>
                      {row.surgeMinor > 0 ? formatMoney(row.surgeMinor) : "—"}
                    </Td>
                    <Td mono numeric>
                      −{formatMoney(row.feeMinor)}
                    </Td>
                    <Td mono numeric strong>
                      {formatMoney(row.netMinor)}
                    </Td>
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

function Summary({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: string;
  count: number;
  tone?: "emergency";
}) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p
        data-numeric
        className={`mt-1 font-display text-2xl font-bold ${
          tone === "emergency" ? "text-emergency-ink" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {count} {count === 1 ? "job" : "jobs"}
      </p>
    </Card>
  );
}

function Th({
  children,
  numeric,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted ${
        numeric ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  numeric,
  strong,
  emphasis,
}: {
  children: React.ReactNode;
  mono?: boolean;
  numeric?: boolean;
  strong?: boolean;
  emphasis?: boolean;
}) {
  return (
    <td
      data-numeric={numeric ? "" : undefined}
      className={`px-3 py-2.5 align-top ${mono ? "font-mono" : ""} ${
        numeric ? "text-right" : ""
      } ${strong ? "font-bold text-ink" : ""} ${
        emphasis ? "font-semibold text-emergency-ink" : ""
      }`}
    >
      {children}
    </td>
  );
}
