import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/auth/session";
import {
  BookingTypeTag,
  Card,
  LifecycleChip,
  Pill,
  SectionTitle,
} from "@/components/ui";
import {
  formatDayTime,
  formatDuration,
  formatMoney,
  formatNotice,
} from "@/lib/format";
import { GlamImage } from "@/components/glam-image";
import { chargeMinorOf, disputedAmountsOf, disputeStageOf } from "@/lib/domain/payment-rules";
import { paymentGateway } from "@/lib/server/payments";
import { DisputeResolver } from "./dispute-resolver";

export const dynamic = "force-dynamic";

/**
 * Admin booking detail (§A-02).
 *
 * The point of this page is explaining a price after the fact: why this
 * booking was classified EMERGENCY, what threshold was in force when it was,
 * what the surcharge came to, who the request went to and who took it. So the
 * stored audit fields are shown under their real names — `notice_period_minutes`
 * rather than "notice" — because the person reading this is reconciling the
 * screen against the row.
 */
export default async function AdminBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "/admin/bookings");
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      items: true,
      hub: true,
      customer: { select: { name: true, email: true } },
      provider: { select: { id: true, name: true, rating: true } },
      events: { orderBy: { createdAt: "asc" } },
      completionPhotos: { orderBy: { position: "asc" } },
      broadcasts: {
        orderBy: { sentAt: "asc" },
        include: { provider: { select: { id: true, name: true } } },
      },
    },
  });

  if (!booking) notFound();

  const accepted = booking.broadcasts.find((row) => row.status === "ACCEPTED");
  const minutesToAcceptance =
    accepted?.respondedAt
      ? Math.round(
          (accepted.respondedAt.getTime() - accepted.sentAt.getTime()) / 60_000,
        )
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/bookings"
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← Booking list
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-bold text-ink">
          {booking.id}
        </h1>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- The classification audit trail --------------------------- */}
        <Card className="p-4">
          <SectionTitle>Classification</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Field name="booking_created_at">
              {formatDayTime(booking.bookingCreatedAt)}
            </Field>
            <Field name="appointment_start_at">
              {formatDayTime(booking.appointmentStartAt)}
            </Field>
            <Field name="notice_period_minutes">
              {booking.noticePeriodMinutes} ({formatNotice(booking.noticePeriodMinutes)})
            </Field>
            <Field name="threshold_minutes_used">
              {booking.thresholdMinutesUsed} (
              {formatDuration(booking.thresholdMinutesUsed)})
            </Field>
            <Field name="booking_type">{booking.bookingType}</Field>
            <Field name="emergency_surcharge">
              {formatMoney(booking.emergencySurchargeMinor)}
            </Field>
            <Field name="total_invoice_price">
              {formatMoney(booking.totalInvoicePriceMinor)}
            </Field>
          </dl>
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
            Computed server-side at creation against the threshold in force at
            that moment, and immutable since. Changing the config today does not
            reclassify this row.
          </p>
        </Card>

        {/* --- Duration and the calendar lock --------------------------- */}
        <Card className="p-4">
          <SectionTitle>Duration</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Field name="service_duration_minutes">
              {booking.serviceDurationMinutes}
            </Field>
            <Field name="reserved_duration_minutes">
              {booking.reservedDurationMinutes} (incl. 15m transition)
            </Field>
            <Field name="reserved_until_at">
              {formatDayTime(booking.reservedUntilAt)}
            </Field>
            <Field name="sector">{booking.sector}</Field>
            <Field name="customer">
              {booking.customer.name} · {booking.customer.email}
            </Field>
            <Field name="provider">
              {booking.provider ? (
                <Link
                  href={`/provider/${booking.provider.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {booking.provider.name}
                </Link>
              ) : (
                "unassigned"
              )}
            </Field>
            <Field name="address_unlocked">
              {booking.addressUnlocked ? "yes" : "no"}
            </Field>
          </dl>
        </Card>

        {/* --- Price breakdown ------------------------------------------ */}
        <Card className="p-4">
          <SectionTitle>Price breakdown</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            {booking.items.map((item) => (
              <Money
                key={item.id}
                label={item.kind === "ADDON" ? `${item.name} (add-on)` : item.name}
                amount={item.priceMinor}
              />
            ))}
            <Money label="Travel fee" amount={booking.travelFeeMinor} />
            {booking.emergencySurchargeMinor > 0 ? (
              <Money
                label="Emergency rate"
                amount={booking.emergencySurchargeMinor}
                emphasis
              />
            ) : null}
            {booking.otherSurchargesMinor > 0 ? (
              <Money
                label="Other surcharges"
                amount={booking.otherSurchargesMinor}
              />
            ) : null}
            <Money label="Trust fee" amount={booking.trustFeeMinor} />
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>Customer total</dt>
              <dd data-numeric>{formatMoney(booking.totalInvoicePriceMinor)}</dd>
            </div>
            <Money
              label="Vendor earnings"
              amount={booking.providerEarningsMinor}
            />
            <Money
              label="— of which surge"
              amount={booking.providerEmergencyEarningsMinor}
              emphasis={booking.providerEmergencyEarningsMinor > 0}
            />
            <Money
              label="Platform"
              amount={
                booking.totalInvoicePriceMinor - booking.providerEarningsMinor
              }
            />
          </dl>
        </Card>

        {/* --- Payment --------------------------------------------------- */}
        <Card className="p-4">
          <SectionTitle hint={paymentGateway().mode === "simulated" ? "test mode" : "Stripe"}>Payment</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Field name="payment_status">{booking.paymentStatus}</Field>
            <Field name="charge">{formatMoney(chargeMinorOf(booking))}</Field>
            {booking.paymentIntentId ? <Field name="payment_intent">{booking.paymentIntentId}</Field> : null}
            {booking.setupIntentId ? <Field name="setup_intent">{booking.setupIntentId}</Field> : null}
            {booking.holdAuthorisedAt ? <Field name="hold_authorised_at">{formatDayTime(booking.holdAuthorisedAt)}</Field> : null}
            {booking.paymentFailureReason ? <Field name="last_failure">{booking.paymentFailureReason}</Field> : null}
            {booking.transferId ? <Field name="transfer">{booking.transferId}</Field> : null}
            <Field name="vendor_payout">{formatMoney(booking.providerPayoutMinor)}</Field>
            <Field name="settlement_status">{booking.settlementStatus}</Field>
            {booking.cancelledBy ? <Field name="cancelled_by">{booking.cancelledBy}{booking.cancelledAt ? ` · ${formatDayTime(booking.cancelledAt)}` : ""}</Field> : null}
            {booking.noShowAt ? <Field name="no_show_marked">{formatDayTime(booking.noShowAt)}</Field> : null}
            {booking.cancellationFeeMinor > 0 ? (
              <Field name="cancellation_fee">
                {formatMoney(booking.cancellationFeeMinor)} · vendor {formatMoney(booking.cancellationFeePayoutMinor)}
              </Field>
            ) : null}
            {booking.refundedMinor > 0 ? <Field name="refunded">{formatMoney(booking.refundedMinor)}{booking.refundId ? ` · ${booking.refundId}` : ""}</Field> : null}
            {booking.clawbackMinor > 0 ? <Field name="recovered_from_vendor">{formatMoney(booking.clawbackMinor)}{booking.transferReversalId ? ` · ${booking.transferReversalId}` : ""}</Field> : null}
          </dl>
          {booking.paymentIntentId.startsWith("pi_") ? (
            <a
              href={`https://dashboard.stripe.com/payments/${booking.paymentIntentId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-accent-700 hover:underline"
            >
              Open in Stripe →
            </a>
          ) : null}
        </Card>
      </div>

      {/* --- Dispute ----------------------------------------------------- */}
      {booking.status === "DISPUTED" && booking.settlementStatus === "DISPUTED" ? (
        <DisputeResolver
          bookingId={booking.id}
          reason={booking.disputeReason}
          stage={disputeStageOf(booking.paymentStatus)}
          chargeMinor={disputedAmountsOf(booking).chargeMinor}
          payoutMinor={disputedAmountsOf(booking).payoutMinor}
          feeOnly={disputedAmountsOf(booking).feeOnly}
        />
      ) : null}

      {booking.settlementStatus === "RESOLVED" ? (
        <Card className="p-4">
          <SectionTitle hint={booking.disputeResolvedAt ? formatDayTime(booking.disputeResolvedAt) : undefined}>
            Dispute resolved
          </SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Field name="customer_reason">{booking.disputeReason || "—"}</Field>
            <Field name="refunded_to_customer">{formatMoney(booking.refundedMinor)}</Field>
            <Field name="recovered_from_vendor">{formatMoney(booking.clawbackMinor)}</Field>
            <Field name="resolved_by">{booking.disputeResolvedBy}</Field>
            <Field name="note">{booking.disputeResolution}</Field>
          </dl>
        </Card>
      ) : null}

      {booking.completionPhotos.length > 0 ? (
        <section>
          <SectionTitle hint="Taken by the vendor at checkout">Finished work</SectionTitle>
          <div className="grid max-w-xl grid-cols-3 gap-2">
            {booking.completionPhotos.map((photo, index) => (
              <GlamImage
                key={photo.id}
                src={photo.url}
                alt={`Finished work, photo ${index + 1}`}
                width={400}
                height={500}
                className="aspect-[4/5] w-full rounded-glam-sm object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Broadcast history ------------------------------------------- */}
      <section>
        <SectionTitle
          hint={
            minutesToAcceptance === null
              ? `${booking.broadcasts.length} sent`
              : `accepted in ${minutesToAcceptance} min`
          }
        >
          Broadcast history
        </SectionTitle>

        {booking.broadcasts.length === 0 ? (
          <Card className="p-4 text-sm text-ink-muted">
            This booking was never broadcast.
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Vendor</Th>
                  <Th>Sent</Th>
                  <Th>Expires</Th>
                  <Th>Responded</Th>
                  <Th>Outcome</Th>
                  <Th numeric>Quoted</Th>
                </tr>
              </thead>
              <tbody>
                {booking.broadcasts.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <Td>{row.provider.name}</Td>
                    <Td mono>{formatDayTime(row.sentAt)}</Td>
                    <Td mono>{formatDayTime(row.expiresAt)}</Td>
                    <Td mono>
                      {row.respondedAt ? formatDayTime(row.respondedAt) : "—"}
                    </Td>
                    <Td>
                      <Pill
                        tone={
                          row.status === "ACCEPTED"
                            ? "positive"
                            : row.status === "PENDING"
                              ? "neutral"
                              : "muted"
                        }
                      >
                        {row.status.toLowerCase()}
                      </Pill>
                    </Td>
                    <Td mono numeric>
                      {formatMoney(row.earningsMinor)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* --- Status timeline ---------------------------------------------- */}
      <section>
        <SectionTitle hint={`${booking.events.length} events`}>
          Status timeline
        </SectionTitle>
        <Card className="divide-y divide-line">
          {booking.events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-ink-muted">
                  {event.fromStatus ?? "—"} →
                </span>
                <LifecycleChip status={event.toStatus} size="sm" />
                {event.note ? (
                  <span className="text-ink-muted">{event.note}</span>
                ) : null}
              </span>
              <span className="font-mono text-ink-muted">
                {event.actor} · {formatDayTime(event.createdAt)}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function Field({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="font-mono text-xs text-ink-muted">{name}</dt>
      <dd data-numeric className="text-right text-ink">
        {children}
      </dd>
    </div>
  );
}

function Money({
  label,
  amount,
  emphasis,
}: {
  label: string;
  amount: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        emphasis ? "font-semibold text-emergency-ink" : "text-ink"
      }`}
    >
      <dt>{label}</dt>
      <dd data-numeric>{formatMoney(amount)}</dd>
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
}: {
  children: React.ReactNode;
  mono?: boolean;
  numeric?: boolean;
}) {
  return (
    <td
      data-numeric={numeric ? "" : undefined}
      className={`whitespace-nowrap px-3 py-2.5 text-ink ${mono ? "font-mono" : ""} ${
        numeric ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}
