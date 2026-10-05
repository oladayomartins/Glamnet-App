import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { confirmPayment } from "@/lib/server/payment-flow";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { BookingTypeTag, Card, SectionTitle, LifecycleChip } from "@/components/ui";
import {
  formatCustomerDayTime,
  formatCustomerTime,
  formatDuration,
  formatMoney,
} from "@/lib/format";
import { BOOKING_STATUSES, PREMISES_SKIPPED_STATUSES } from "@/lib/domain/types";
import { canDispute, effectiveSettlementStatus } from "@/lib/domain/completion";
import { isImageKitConfigured } from "@/lib/imagekit";
import { paymentGateway } from "@/lib/server/payments";
import { GlamImage } from "@/components/glam-image";
import { JobActions } from "./job-actions";
import { ReviewForm } from "./review-form";
import { CheckoutPin, DisputeForm } from "./customer-escrow";
import { UpdateCard } from "./update-card";
import { PushPrompt } from "@/components/push-prompt";
import { CancelBooking, CancelTooLate } from "./cancel-booking";
import { quoteCustomerCancellation, noShowAllowedFrom, PROVIDER_CANCELLABLE } from "@/lib/domain/cancellation";
import { formatAppointment } from "@/lib/server/notifications";
import { messagingOpen } from "@/lib/domain/messaging";
import { rescheduleBlocker } from "@/lib/domain/reschedule";
import { pendingReschedule } from "@/lib/server/reschedule";
import { BookingMessages } from "./booking-messages";
import { ReschedulePanel } from "./reschedule-panel";
import { ReviewReplyForm } from "@/components/review-reply-form";
import { ClientNoteEditor } from "@/components/client-note-editor";
import { clientNoteFor } from "@/lib/server/clients";

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
      provider: {
        select: {
          name: true,
          slug: true,
          rating: true,
          workspaceAddress: true,
          basePostcode: true,
          workspaceSector: true,
          howToFindMe: true,
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      completionPhotos: { orderBy: { position: "asc" } },
      promoCode: { select: { code: true } },
      customer: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
        select: { id: true, senderRole: true, body: true, createdAt: true },
      },
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

  // Back from a bank's approval page (3-D Secure), or a checkout left
  // half-way: ask Stripe whether the card went through, and if it did, move
  // the booking on before showing it.
  if (viewer.customerId === booking.customerId && booking.paymentStatus === "PENDING_AUTHORISATION") {
    const secured = await confirmPayment(booking.id, booking.customerId).then(
      () => true,
      // Not through yet: the page offers to finish adding the card.
      () => false,
    );
    if (secured) redirect(`/bookings/${booking.id}`);
  }

  const atPremises = booking.serviceLocation === "VENDOR_PREMISES";
  const steps = BOOKING_STATUSES.filter(
    (status) => !atPremises || !PREMISES_SKIPPED_STATUSES.includes(status),
  );
  const reachedIndex = steps.indexOf(booking.status as (typeof steps)[number]);
  const now = new Date();
  const settlement = effectiveSettlementStatus(booking, now);

  // The same record is two screens: the customer's booking (§C-09) and the
  // vendor's job (§P-05). Which one you get is decided here, from the
  // viewer's relationship to the booking, not from a query parameter.
  const isTheProvider =
    booking.providerId !== null && viewer.providerId === booking.providerId;
  const isTheCustomer = viewer.customerId === booking.customerId;
  // Reviews follow the PIN release now, rather than gating it.
  const awaitingReview = booking.status === "PAYMENT_RELEASED";
  const mayDispute =
    isTheCustomer &&
    ((booking.status === "COMPLETED" && booking.settlementStatus === "OPEN") ||
      canDispute(booking, now));
  const ended = ["CANCELLED", "EXPIRED", "NO_SHOW"].includes(booking.status);
  // What cancelling costs right now; the endpoint charges exactly this.
  const cancelQuote = isTheCustomer && !ended ? quoteCustomerCancellation(booking, now) : null;
  const arrivedAt = booking.events.findLast((event) => event.toStatus === "ARRIVED")?.createdAt ?? null;
  const noShowFrom = isTheProvider
    ? noShowAllowedFrom(booking, booking.serviceLocation === "VENDOR_PREMISES" ? null : arrivedAt)
    : null;

  // Where the appointment happens, for the people allowed to know. A client
  // gets the vendor's street address once their card is secured — not on a
  // bare request, so the address cannot be harvested by booking and walking
  // away. The vendor's own job view handles the client's address unlock.
  const paid = !["NOT_STARTED", "PENDING_AUTHORISATION", "AUTHORISATION_FAILED"].includes(booking.paymentStatus);
  const place = (() => {
    if (atPremises) {
      const provider = booking.provider;
      if (!provider) return null;
      const street = [provider.workspaceAddress, provider.basePostcode].filter(Boolean).join(", ");
      const mayKnow = viewer.role === "ADMIN" || isTheProvider || (isTheCustomer && paid && !ended);
      if (mayKnow && street) return { line: street, directions: provider.howToFindMe, map: true };
      // The vendor's own job: nothing to wait for, only an address to add.
      if (isTheProvider) {
        return provider.workspaceAddress
          ? null
          : { line: "Add your workspace's street address in setup, so clients can find you.", directions: "", map: false };
      }
      return {
        line: mayKnow
          ? `${provider.workspaceSector || booking.sector} — ask ${provider.name} for the exact address in Messages below`
          : `${provider.workspaceSector || booking.sector} — the full address shows here once your card is secured`,
        directions: "",
        map: false,
      };
    }
    if ((isTheCustomer || viewer.role === "ADMIN") && booking.addressLine) {
      return { line: booking.addressLine, directions: "", map: true };
    }
    return null;
  })();

  // Messages and moving the appointment are between the two people on it.
  const party: "CUSTOMER" | "PROVIDER" | null = isTheCustomer ? "CUSTOMER" : isTheProvider ? "PROVIDER" : null;
  const otherName = isTheCustomer
    ? (booking.provider?.name ?? "your vendor")
    : booking.customer.name.split(/\s+/)[0] || "your client";
  const threadOpen = messagingOpen(booking, now);
  // The vendor's own private note on this client, beside the job.
  const clientNote = isTheProvider && booking.providerId ? await clientNoteFor(booking.providerId, booking.customerId) : null;
  const showThread =
    booking.providerId !== null && (party !== null || viewer.role === "ADMIN") && (threadOpen || booking.messages.length > 0);
  const rescheduleOffer = pendingReschedule(booking);
  const mayReschedule = party !== null && rescheduleBlocker(booking) === null;

  const priceRows = [
    ...booking.items.map((item) => ({
      label: item.kind === "ADDON" ? `${item.name} (add-on)` : item.name,
      amount: item.priceMinor,
      emphasis: false,
    })),
    // Nobody travels to a workspace booking, so there is no travel line.
    ...(atPremises && booking.travelFeeMinor === 0
      ? []
      : [{ label: "Travel fee", amount: booking.travelFeeMinor, emphasis: false }]),
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
    ...(booking.trustFeeMinor > 0
      ? [{ label: "Trust fee", amount: booking.trustFeeMinor, emphasis: false }]
      : []),
    ...(booking.tipMinor > 0
      ? [{ label: "Tip", amount: booking.tipMinor, emphasis: false }]
      : []),
    ...(booking.discountMinor > 0
      ? [
          {
            label: `Promo${booking.promoCode ? ` ${booking.promoCode.code}` : ""}`,
            amount: -booking.discountMinor,
            emphasis: false,
          },
        ]
      : []),
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
          {place ? (
            <div className="mt-3 rounded-glam-sm bg-sunken p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {atPremises ? "Where to go" : "Your address"}
              </p>
              <p className="mt-1 text-[15px] text-ink">{place.line}</p>
              {place.directions ? (
                <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{place.directions}</p>
              ) : null}
              {place.map ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.line)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                >
                  Open in maps
                </a>
              ) : null}
            </div>
          ) : null}
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
                {formatMoney(booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus}
            {paymentGateway().mode === "simulated" && booking.paymentStatus !== "NOT_STARTED"
              ? " · test mode, no card was charged"
              : ""}
            {settlement === "CLOSED_UNCONTESTABLE" ? " · closed, no longer contestable" : ""}
            {settlement === "DISPUTED" ? " · under dispute" : ""}
            {settlement === "RESOLVED" ? " · dispute resolved" : ""}
          </p>
          {isTheProvider || viewer.role === "ADMIN" ? (
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-muted">
              <Row label="Booked via">
                {SOURCE_LABELS[booking.source] ?? booking.source}
                {booking.firstDiscoveryBooking ? " · first discovery booking" : ""}
              </Row>
              <Row label="Marketplace commission">
                {booking.commissionBps / 100}% ({formatMoney(booking.platformCommissionMinor)})
              </Row>
              {booking.processingFeeMinor > 0 ? (
                <Row label="Card processing">{formatMoney(booking.processingFeeMinor)}</Row>
              ) : null}
              <Row label="Vendor payout">{formatMoney(booking.providerPayoutMinor)}</Row>
            </dl>
          ) : null}
        </Card>
      </div>

      {isTheCustomer &&
      (booking.paymentStatus === "AUTHORISATION_FAILED" ||
        (booking.paymentStatus === "PENDING_AUTHORISATION" && ["REQUESTED", "ACCEPTED"].includes(booking.status))) &&
      !["CANCELLED", "EXPIRED", "NO_SHOW", "COMPLETED", "DISPUTED"].includes(booking.status) ? (
        <UpdateCard
          bookingId={booking.id}
          amountMinor={booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor}
          reason={booking.paymentFailureReason}
          unfinished={booking.paymentStatus === "PENDING_AUTHORISATION"}
        />
      ) : null}

      {isTheCustomer && !["CANCELLED", "EXPIRED", "NO_SHOW", "REVIEWED"].includes(booking.status) ? (
        <PushPrompt audience="CUSTOMER" />
      ) : null}

      {ended && booking.status !== "EXPIRED" ? (
        <Card className="p-4">
          <SectionTitle hint={booking.cancelledAt ? formatAppointment(booking.cancelledAt) : undefined}>
            {booking.status === "NO_SHOW" ? "Missed appointment" : "Booking cancelled"}
          </SectionTitle>
          <p className="text-sm text-ink">
            {booking.status === "NO_SHOW"
              ? isTheCustomer
                ? "Your vendor waited and marked this appointment as missed."
                : "You marked the client as a no-show."
              : booking.cancelledBy === "CUSTOMER"
                ? isTheCustomer
                  ? "You cancelled this booking."
                  : "The client cancelled this booking."
                : booking.cancelledBy === "PROVIDER"
                  ? isTheCustomer
                    ? "Your vendor had to cancel this booking."
                    : "You cancelled this booking."
                  : "This booking was cancelled."}{" "}
            {booking.cancellationFeeMinor > 0
              ? isTheProvider
                ? `Under the cancellation policy you receive ${formatMoney(booking.cancellationFeePayoutMinor)}.`
                : `A ${booking.status === "NO_SHOW" ? "missed-appointment" : "late-cancellation"} fee of ${formatMoney(booking.cancellationFeeMinor)} was charged; the rest of the hold was released.`
              : isTheProvider
                ? ""
                : "Nothing was charged."}
          </p>
          {booking.cancelledBy === "PROVIDER" && isTheCustomer && booking.cancelledReason ? (
            <p className="mt-2 text-sm text-ink-muted">{booking.cancelledReason.replace(/^Cancelled by the vendor: /, "")}</p>
          ) : null}
        </Card>
      ) : null}

      {party && (rescheduleOffer || mayReschedule) ? (
        <ReschedulePanel
          bookingId={booking.id}
          viewerRole={party}
          otherName={otherName}
          pending={rescheduleOffer}
          canSuggest={mayReschedule}
        />
      ) : null}

      {cancelQuote?.allowed ? (
        <CancelBooking
          bookingId={booking.id}
          feeMinor={cancelQuote.feeMinor}
          explanation={cancelQuote.explanation}
          freeUntilLabel={cancelQuote.freeUntil ? formatAppointment(cancelQuote.freeUntil) : null}
        />
      ) : cancelQuote && booking.status === "ARRIVED" ? (
        <CancelTooLate explanation={cancelQuote.explanation} />
      ) : null}

      {booking.settlementStatus === "RESOLVED" && (isTheCustomer || isTheProvider) ? (
        <Card className="p-4">
          <SectionTitle>Dispute resolved</SectionTitle>
          <p className="text-sm text-ink">
            {isTheCustomer
              ? booking.refundedMinor > 0
                ? `${formatMoney(booking.refundedMinor)} ${booking.refundId ? "has been refunded to your card" : "was taken off what you were charged"}.`
                : "The GLAMNET team reviewed this booking and no refund was due."
              : booking.clawbackMinor > 0
                ? `${formatMoney(booking.clawbackMinor)} was deducted from your payout for this booking.`
                : "The GLAMNET team reviewed this booking and your payout stands."}
          </p>
          {booking.disputeResolution ? (
            <p className="mt-2 text-sm text-ink-muted">&ldquo;{booking.disputeResolution}&rdquo;</p>
          ) : null}
        </Card>
      ) : null}

      {isTheCustomer && booking.status === "COMPLETED" && booking.completionPin ? (
        <CheckoutPin pin={booking.completionPin} providerName={booking.provider?.name ?? "your vendor"} />
      ) : null}

      {booking.completionPhotos.length > 0 ? (
        <Card className="p-4">
          <SectionTitle hint="Taken by the vendor at checkout">Finished work</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
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
        </Card>
      ) : null}

      {isTheProvider ? (
        <JobActions
          bookingId={booking.id}
          status={booking.status}
          serviceLocation={booking.serviceLocation}
          // Props are serialised into the page, so the address is only sent
          // once it is unlocked, not merely hidden on screen until then.
          addressLine={booking.addressUnlocked ? booking.addressLine : ""}
          addressUnlocked={booking.addressUnlocked}
          paymentStatus={booking.paymentStatus}
          imageUploadsEnabled={isImageKitConfigured()}
          mayCancel={PROVIDER_CANCELLABLE.includes(booking.status)}
          noShowFrom={noShowFrom?.toISOString() ?? null}
          noShowFromLabel={noShowFrom ? formatAppointment(noShowFrom) : null}
        />
      ) : null}

      {isTheProvider && clientNote !== null && !ended ? (
        <Card className="p-4">
          <SectionTitle
            hint={
              <Link href={`/provider/${booking.providerId}/clients/${booking.customerId}`} className="hover:text-brand-700">
                Client history →
              </Link>
            }
          >
            Your notes on {booking.customer.name.split(/\s+/)[0] || "this client"}
          </SectionTitle>
          <ClientNoteEditor
            customerId={booking.customerId}
            clientName={booking.customer.name}
            initialNote={clientNote}
            compact
          />
        </Card>
      ) : null}

      {showThread ? (
        <BookingMessages
          bookingId={booking.id}
          viewerRole={party ?? "ADMIN"}
          otherName={otherName}
          initial={booking.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))}
          open={party !== null && threadOpen}
        />
      ) : null}

      {isTheCustomer && awaitingReview && booking.provider ? (
        <ReviewForm bookingId={booking.id} providerName={booking.provider.name} />
      ) : null}

      {mayDispute ? (
        <DisputeForm
          bookingId={booking.id}
          closesAt={booking.disputeWindowClosesAt?.toISOString() ?? null}
          feeOnly={booking.cancellationFeeMinor > 0}
        />
      ) : null}

      {booking.status === "DISPUTED" && booking.disputeReason ? (
        <Card className="border-l-4 border-l-warning p-4">
          <SectionTitle>Dispute filed</SectionTitle>
          <p className="text-[15px] text-ink">{booking.disputeReason}</p>
        </Card>
      ) : null}

      {booking.rating ? (
        <Card className="p-4">
          <SectionTitle hint={`${booking.rating}/5`}>{isTheCustomer ? "Your review" : "Client's review"}</SectionTitle>
          {booking.reviewNote ? (
            <p className="text-[15px] text-ink">{booking.reviewNote}</p>
          ) : (
            <p className="text-[15px] text-ink-muted">
              {isTheCustomer ? "You" : "They"} rated this {booking.rating} out of 5 without writing anything.
            </p>
          )}
          {isTheProvider ? (
            <ReviewReplyForm bookingId={booking.id} initialReply={booking.reviewReply} />
          ) : booking.reviewReply ? (
            <div className="mt-3 rounded-glam-sm border-l-2 border-accent-500 bg-sunken p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Reply from {booking.provider?.name ?? "your vendor"}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{booking.reviewReply}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {isTheCustomer && booking.provider?.slug && ["REVIEWED", "PAYMENT_RELEASED"].includes(booking.status) ? (
        <Link
          href={`/pro/${booking.provider.slug}`}
          className="flex min-h-12 items-center justify-center rounded-full bg-surface px-6 text-sm font-bold text-ink ring-1 ring-line transition duration-[180ms] hover:bg-sunken active:scale-[0.98]"
        >
          Book {booking.provider.name.split(/\s+/)[0]} again
        </Link>
      ) : null}

      <Card className="p-4">
        <SectionTitle hint={`${booking.events.length} events`}>Progress</SectionTitle>
        <ol className="grid gap-1 sm:grid-cols-2">
          {steps.map((status, index) => {
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

const PAYMENT_LABELS: Record<string, string> = {
  NOT_STARTED: "No card hold on this booking",
  PENDING_AUTHORISATION: "Waiting for your card to be authorised",
  AUTHORISED: "Held on your card — released by your PIN after the appointment",
  ESCROW_RELEASED: "Paid to your vendor",
  VOIDED: "Card hold released — nothing was charged",
  CARD_SAVED: "Card saved — we'll hold the amount five days before your appointment",
  AUTHORISATION_FAILED: "We couldn't hold your card — please update it",
  REFUNDED: "Refunded to your card",
  PARTIALLY_REFUNDED: "Partly refunded to your card",
};

const SOURCE_LABELS: Record<string, string> = {
  BROADCAST: "Request broadcast",
  MARKETPLACE: "Marketplace directory",
  DIRECT_LINK: "Your direct link",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
