import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { BookingTypeTag, Card, SectionTitle, LifecycleChip } from "@/components/ui";
import {
  formatCustomerDayTime,
  formatCustomerTime,
  formatDuration,
  formatMoney,
} from "@/lib/format";
import { BOOKING_STATUSES } from "@/lib/domain/types";
import { JobActions } from "./job-actions";
import { ReviewForm } from "./review-form";

/**
 * Customer-facing booking record. Shows the classification and the surcharge
 * that was applied, retained from creation through completion (spec §8).
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      items: true,
      hub: true,
      provider: { select: { name: true, rating: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!booking) notFound();

  // Ownership, not just sign-in: a booking carries an address and a price.
  // notFound() rather than a forbidden page, so an outsider cannot learn that
  // a given booking id exists.
  const viewer = await requireUser(`/bookings/${id}`);
  const mayView =
    viewer.role === "ADMIN" ||
    viewer.customerId === booking.customerId ||
    (booking.providerId !== null && viewer.providerId === booking.providerId);
  if (!mayView) notFound();

  const reachedIndex = BOOKING_STATUSES.indexOf(
    booking.status as (typeof BOOKING_STATUSES)[number],
  );

  // The same record is two screens: the customer's booking (§C-09) and the
  // vendor's job (§P-05). Which one you get is decided here, from the
  // viewer's relationship to the booking, not from a query parameter.
  const isTheProvider =
    booking.providerId !== null && viewer.providerId === booking.providerId;
  const isTheCustomer = viewer.customerId === booking.customerId;
  const awaitingReview = booking.status === "COMPLETED";

  const priceRows = [
    ...booking.items.map((item) => ({
      label: item.kind === "ADDON" ? `${item.name} (add-on)` : item.name,
      amount: item.priceMinor,
      emphasis: false,
    })),
    { label: "Travel fee", amount: booking.travelFeeMinor, emphasis: false },
    ...(booking.emergencySurchargeMinor > 0
      ? [
          {
            label: "Emergency booking surcharge",
            amount: booking.emergencySurchargeMinor,
            emphasis: true,
          },
        ]
      : []),
    ...(booking.otherSurchargesMinor > 0
      ? [
          {
            label: "Other surcharges",
            amount: booking.otherSurchargesMinor,
            emphasis: false,
          },
        ]
      : []),
    { label: "Trust fee", amount: booking.trustFeeMinor, emphasis: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="tap-44 text-sm text-ink-muted hover:text-brand-700">
          ← Home
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          {formatCustomerDayTime(booking.appointmentStartAt)}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {booking.hub.name} · {booking.hub.sector} ·{" "}
          {formatDuration(booking.serviceDurationMinutes)} of services
        </p>

        {/*
          Status and type are two fields, never merged into one label. The
          operational chip moves through the lifecycle on its own colour scale
          while the red EMERGENCY tag rides alongside it the whole way — a
          single combined label would have to choose between them.
        */}
        <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Status
            </dt>
            <dd>
              <LifecycleChip status={booking.status} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Type
            </dt>
            <dd>
              <BookingTypeTag bookingType={booking.bookingType} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Your appointment</SectionTitle>
          <ul className="space-y-1 text-sm text-ink">
            {booking.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.name}</span>
                <span className="text-ink-muted">
                  {formatDuration(item.durationMinutes)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <Row label="Booked">
              {formatCustomerDayTime(booking.bookingCreatedAt)}
            </Row>
            <Row label="Notice given">
              {formatDuration(Math.max(0, booking.noticePeriodMinutes))}
            </Row>
            <Row label="Emergency threshold">
              {formatDuration(booking.thresholdMinutesUsed)}
            </Row>
            <Row label="Vendor time reserved">
              {formatCustomerTime(booking.appointmentStartAt)}–
              {formatCustomerTime(booking.reservedUntilAt)} (
              {formatDuration(booking.reservedDurationMinutes)}, incl. transition)
            </Row>
            {booking.provider ? (
              <Row label="Provider">
                {booking.provider.name} · {booking.provider.rating.toFixed(1)}★
              </Row>
            ) : null}
          </dl>
        </Card>

        <Card className="p-4">
          <SectionTitle>What you paid</SectionTitle>
          <dl className="space-y-1.5">
            {priceRows.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between gap-4 text-sm ${
                  row.emphasis ? "font-semibold text-emergency-ink" : "text-ink"
                }`}
              >
                <dt>{row.label}</dt>
                <dd className="tabular-nums">{formatMoney(row.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatMoney(booking.totalInvoicePriceMinor)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {isTheProvider ? (
        <JobActions
          bookingId={booking.id}
          status={booking.status}
          addressLine={booking.addressLine}
          addressUnlocked={booking.addressUnlocked}
        />
      ) : null}

      {isTheCustomer && awaitingReview && booking.provider ? (
        <ReviewForm bookingId={booking.id} providerName={booking.provider.name} />
      ) : null}

      {booking.rating ? (
        <Card className="p-4">
          <SectionTitle hint={`${booking.rating}/5`}>Your review</SectionTitle>
          {booking.reviewNote ? (
            <p className="text-[15px] text-ink">{booking.reviewNote}</p>
          ) : (
            <p className="text-[15px] text-ink-muted">
              You rated this {booking.rating} out of 5 without writing anything.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle hint={`${booking.events.length} events`}>Progress</SectionTitle>
        <ol className="grid gap-1 sm:grid-cols-2">
          {BOOKING_STATUSES.map((status, index) => {
            const reached = reachedIndex >= index;
            const current = reachedIndex === index;
            return (
              <li
                key={status}
                aria-current={current ? "step" : undefined}
                className="flex items-center gap-2 rounded-glam-sm px-2 py-1"
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    reached ? "bg-brand-700" : "bg-line"
                  }`}
                />
                {current ? (
                  <LifecycleChip status={status} size="sm" />
                ) : (
                  <span
                    className={`text-sm ${reached ? "text-ink" : "text-ink-muted/60"}`}
                  >
                    {status.replaceAll("_", " ").toLowerCase()}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
