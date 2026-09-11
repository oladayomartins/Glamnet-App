import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/auth/session";
import { buildEmergencyReport } from "@/lib/server/reporting";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import { BookingTypeTag, Card, EmptyState, SectionTitle, StatusPill } from "@/components/ui";
import {
  describeSurcharge,
  formatDayTime,
  formatDuration,
  formatMoney,
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
      include: {
        items: true,
        customer: { select: { name: true } },
        provider: { select: { name: true } },
      },
    }),
    getActiveEmergencyConfig(),
  ]);

  return (
    <div className="space-y-8">
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
          Review provider applications →
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
            label="Provider acceptance"
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
            label="Emergency provider earnings"
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
              className={`tap-44 rounded-full px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wider transition ${
                filter === option
                  ? "bg-brand-700 text-on-brand"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:bg-sunken"
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>

        {bookings.length === 0 ? (
          <EmptyState>No bookings match this filter.</EmptyState>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-glam border border-line bg-surface p-3 shadow-card transition hover:border-brand-400"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BookingTypeTag bookingType={booking.bookingType} size="sm" />
                    <StatusPill status={booking.status} />
                    <span className="text-sm font-semibold text-ink">
                      {formatDayTime(booking.appointmentStartAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {booking.customer.name} →{" "}
                    {booking.provider?.name ?? "awaiting provider"} ·{" "}
                    {booking.items.map((item) => item.name).join(" + ")} ·{" "}
                    {booking.sector}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDuration(booking.noticePeriodMinutes)} notice ·{" "}
                    {formatDuration(booking.reservedDurationMinutes)} reserved
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {formatMoney(booking.totalInvoicePriceMinor)}
                  </p>
                  {booking.emergencySurchargeMinor > 0 ? (
                    <p className="text-xs font-semibold text-emergency-ink">
                      +{formatMoney(booking.emergencySurchargeMinor)} surge
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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
