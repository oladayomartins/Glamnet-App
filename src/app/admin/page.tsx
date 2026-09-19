import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/auth/session";
import { buildEmergencyReport } from "@/lib/server/reporting";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import { ListMagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { BookingTypeTag, Card, EmptyState, SectionTitle, LifecycleChip } from "@/components/ui";
import {
  describeSurcharge,
  formatDay,
  formatDayTime,
  formatDuration,
  formatMoney,
  formatNotice,
} from "@/lib/format";
import { EmergencyConfigForm } from "./config-form";

const FILTERS = [
  "ALL",
  "NORMAL",
  "EMERGENCY",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;

type Filter = (typeof FILTERS)[number];

function whereFor(filter: Filter) {
  if (filter === "NORMAL" || filter === "EMERGENCY") return { bookingType: filter };
  if (filter === "ALL") return {};
  return { status: filter };
}

/** Admin dashboard: filtering, emergency identification and reporting (spec §10). */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  // Admin only. Previously this page and its data were public.
  await requireRole("ADMIN", "/admin");

  const { filter: rawFilter } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(rawFilter ?? "")
    ? (rawFilter as Filter)
    : "ALL";

  const [report, bookings, config] = await Promise.all([
    buildEmergencyReport(),
    prisma.booking.findMany({
      where: whereFor(filter),
      orderBy: { bookingCreatedAt: "desc" },
      take: 100,
      // The ledger table names the parties and the money, not the basket —
      // so the basket is not fetched for a hundred rows.
      include: {
        customer: { select: { name: true } },
        provider: { select: { name: true } },
      },
    }),
    getActiveEmergencyConfig(),
  ]);

  return (
    /*
     * Wide, like the marketplace pages. The booking ledger is ten columns and
     * asks for 1040px; the app width gives it 992 and it scrolled sideways on
     * every desktop, which on the one screen built for comparing rows is the
     * worst place to lose two columns off the edge. Widening the shell is the
     * fix rather than shrinking the table: the columns are all load-bearing.
     */
    <div data-page-width="wide" className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Emergency performance, commercial configuration and the full booking
          ledger.
        </p>
        <Link
          href="/admin/providers"
          className="mt-3 inline-flex rounded-glam-sm bg-surface px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-sunken"
        >
          Review vendor applications →
        </Link>
      </div>

      {/* --- Reporting (spec §10) --------------------------------------- */}
      <section>
        <SectionTitle>Emergency performance</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total bookings" value={String(report.totalBookings)} />
          <Metric label="Normal" value={String(report.normalBookings)} />
          <Metric
            label="Emergency"
            value={String(report.emergencyBookings)}
            tone="emergency"
          />
          <Metric
            label="Emergency share"
            value={`${report.emergencyBookingPercentage}%`}
            tone="emergency"
          />
          <Metric
            label="Emergency revenue"
            value={formatMoney(report.emergencyRevenueMinor)}
          />
          <Metric
            label="Surcharge revenue"
            value={formatMoney(report.emergencySurchargeRevenueMinor)}
            tone="emergency"
          />
          <Metric
            label="Vendor acceptance"
            value={`${report.providerAcceptanceRate}%`}
          />
          <Metric
            label="Avg. time to accept"
            value={
              report.averageMinutesToAcceptance === null
                ? "—"
                : `${report.averageMinutesToAcceptance} min`
            }
          />
          <Metric
            label="Emergency cancellations"
            value={`${report.emergencyCancellationRate}%`}
          />
          <Metric
            label="Normal cancellations"
            value={`${report.normalCancellationRate}%`}
          />
          <Metric
            label="Emergency fulfilment"
            value={`${report.emergencyFulfilmentRate}%`}
          />
          <Metric
            label="Emergency vendor earnings"
            value={formatMoney(report.emergencyProviderEarningsMinor)}
          />
        </div>
      </section>

      {/* --- Commercial configuration (spec §5) ------------------------- */}
      <section>
        <SectionTitle
          hint={
            config
              ? `Currently ${describeSurcharge(config.surchargeType, config.surchargeValue)} over ${formatDuration(config.thresholdMinutes)}`
              : "Not configured"
          }
        >
          Emergency pricing
        </SectionTitle>
        <EmergencyConfigForm
          thresholdMinutes={config?.thresholdMinutes ?? 720}
          surchargeType={config?.surchargeType ?? "PERCENTAGE"}
          surchargeValue={config?.surchargeValue ?? 2_500}
        />
      </section>

      {/* --- Booking ledger (spec §10) ---------------------------------- */}
      <section>
        <SectionTitle hint={`${bookings.length} shown`}>Bookings</SectionTitle>

        <nav className="mb-3 flex flex-wrap gap-2" aria-label="Booking filters">
          {FILTERS.map((option) => (
            <Link
              key={option}
              href={option === "ALL" ? "/admin" : `/admin?filter=${option}`}
              aria-current={filter === option ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 font-mono text-xs font-medium uppercase tracking-wider transition duration-[180ms] ease-glam ${
                filter === option
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:bg-sunken"
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<ListMagnifyingGlass size={24} weight="light" />}
            title="Nothing under this filter"
            action={
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                Show every booking
              </Link>
            }
          >
            No booking matches {filter.toLowerCase()}.
          </EmptyState>
        ) : (
          /*
           * A table, not cards. Admin is the one surface in the product where
           * density beats comfort — the job here is comparing a hundred rows,
           * and 13px is acceptable here and nowhere in the customer PWA.
           */
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Ref</Th>
                  <Th>Created</Th>
                  <Th>Appointment</Th>
                  <Th numeric>Notice</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Vendor</Th>
                  <Th>Customer</Th>
                  <Th numeric>Total</Th>
                  <Th numeric>Surcharge</Th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="border-b border-line/70 last:border-0"
                  >
                    <Td mono>
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {booking.id.slice(-8)}
                      </Link>
                    </Td>
                    <Td>{formatDay(booking.bookingCreatedAt)}</Td>
                    <Td>{formatDayTime(booking.appointmentStartAt)}</Td>
                    <Td mono numeric>
                      {formatNotice(booking.noticePeriodMinutes)}
                    </Td>
                    <Td>
                      {/* Every emergency row carries the tag, at every width. */}
                      <BookingTypeTag
                        bookingType={booking.bookingType}
                        size="sm"
                      />
                    </Td>
                    <Td>
                      <LifecycleChip status={booking.status} size="sm" />
                    </Td>
                    <Td>
                      {booking.provider?.name ?? (
                        <span className="text-ink-muted">unassigned</span>
                      )}
                    </Td>
                    <Td>{booking.customer.name}</Td>
                    <Td mono numeric strong>
                      {formatMoney(booking.totalInvoicePriceMinor)}
                    </Td>
                    <Td mono numeric emphasis={booking.emergencySurchargeMinor > 0}>
                      {booking.emergencySurchargeMinor > 0
                        ? formatMoney(booking.emergencySurchargeMinor)
                        : "—"}
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
      className={`whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted ${
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
      className={`whitespace-nowrap px-3 py-2.5 text-ink ${mono ? "font-mono" : ""} ${
        numeric ? "text-right" : ""
      } ${strong ? "font-bold" : ""} ${
        emphasis ? "font-semibold text-emergency-ink" : ""
      }`}
    >
      {children}
    </td>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emergency";
}) {
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${
          tone === "emergency" ? "text-emergency-ink" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
