import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  BOOKING_FILTERS,
  bookingListWhere,
  parseBookingFilter,
  type BookingFilter,
} from "@/lib/server/admin/booking-filters";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/auth/session";
import { buildEmergencyReport } from "@/lib/server/reporting";
import { ListMagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { BookingTypeTag, Card, EmptyState, SectionTitle, LifecycleChip } from "@/components/ui";
import {
  formatDay,
  formatDayTime,
  formatMoney,
  formatNotice,
} from "@/lib/format";

const FILTERS = BOOKING_FILTERS;
type Filter = BookingFilter;

const PAGE_SIZE = 50;

/** Booking ledger: filtering, emergency identification and reporting (spec §10). */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  await requireRole("ADMIN", "/admin/bookings");

  const { filter: rawFilter, q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const filter: Filter = parseBookingFilter(rawFilter);

  const where: Prisma.BookingWhereInput = bookingListWhere(filter, q);
  const [report, bookings, total] = await Promise.all([
    buildEmergencyReport(),
    prisma.booking.findMany({
      where,
      orderBy: { bookingCreatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // The ledger table names the parties and the money, not the basket —
      // so the basket is not fetched for a hundred rows.
      include: {
        customer: { select: { name: true } },
        provider: { select: { name: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (next: { filter?: Filter; page?: number; q?: string }) => {
    const params = new URLSearchParams();
    const nextFilter = next.filter ?? filter;
    const nextQ = next.q ?? q;
    if (nextFilter !== "ALL") params.set("filter", nextFilter);
    if (nextQ) params.set("q", nextQ);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `/admin/bookings?${query}` : "/admin/bookings";
  };
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE);

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
        <h1 className="font-display text-2xl font-bold text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every booking on the platform, with emergency performance. Open a booking to step in on it.
        </p>
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

      {/* --- Booking ledger (spec §10) ---------------------------------- */}
      <section>
        <SectionTitle
          hint={
            <span className="flex flex-wrap items-center gap-3">
              {total === 0 ? "None" : `${first}–${last} of ${total}`}
              {total > 0 ? (
                <a
                  href={`/api/admin/exports/bookings?${new URLSearchParams({ filter, q }).toString()}`}
                  download
                  className="font-semibold text-accent-700 hover:underline"
                >
                  Download CSV
                </a>
              ) : null}
            </span>
          }
        >
          Bookings
        </SectionTitle>

        <form className="mb-3 flex flex-wrap gap-2" role="search">
          {filter !== "ALL" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search booking id, customer or vendor name or email"
            aria-label="Search bookings"
            className="min-h-11 w-full max-w-md rounded-glam-sm border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent-500"
          />
          <button type="submit" className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line hover:bg-sunken">
            Search
          </button>
          {q ? (
            <Link href={hrefFor({ page: 1, q: "" })} className="inline-flex min-h-11 items-center px-2 text-sm text-accent-700 hover:underline">
              Clear search
            </Link>
          ) : null}
        </form>

        <nav className="mb-3 flex flex-wrap gap-2" aria-label="Booking filters">
          {FILTERS.map((option) => (
            <Link
              key={option}
              href={hrefFor({ filter: option, page: 1 })}
              aria-current={filter === option ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 font-mono text-xs font-medium uppercase tracking-wider transition duration-[180ms] ease-glam ${
                filter === option
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:bg-sunken"
              }`}
            >
              {option === "NO_SHOW" ? "No-show" : option}
            </Link>
          ))}
        </nav>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<ListMagnifyingGlass size={24} weight="light" />}
            title="Nothing under this filter"
            action={
              <Link
                href="/admin/bookings"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                Show every booking
              </Link>
            }
          >
            {q ? `No booking matches “${q}”${filter === "ALL" ? "" : ` under ${filter.toLowerCase()}`}.` : `No booking matches ${filter.toLowerCase()}.`}
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
                      {booking.provider && booking.providerId ? (
                        <Link href={`/admin/accounts/${booking.providerId}`} className="hover:text-accent-700">
                          {booking.provider.name}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <Link href={`/admin/accounts/${booking.customerId}`} className="hover:text-accent-700">
                        {booking.customer.name}
                      </Link>
                    </Td>
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

        {pages > 1 ? (
          <nav aria-label="Booking pages" className="mt-3 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? (
              <Link href={hrefFor({ page: page - 1 })} className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-muted" data-numeric>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={hrefFor({ page: page + 1 })} className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
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
