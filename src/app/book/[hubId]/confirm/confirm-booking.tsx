"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightning } from "@phosphor-icons/react";
import { CardHold } from "@/components/card-hold";
import { CancellationTerms } from "@/components/cancellation-terms";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { BookingTypeTag, Button, Card, DurationStrip } from "@/components/ui";
import { SearchingForProvider } from "../searching";
import { CURRENCY, serviceItem, toMajor, track, trackBookingPlaced } from "@/lib/analytics";
import { AddressFields, EMPTY_ADDRESS, formatAddress, type AddressValue } from "@/components/address-fields";
import {
  formatCustomerDayTime,
  formatCustomerTime,
  formatDuration,
  formatMoney,
} from "@/lib/format";

interface PriceLine {
  key: string;
  label: string;
  amountMinor: number;
  emphasis?: string;
}

export interface ConfirmQuote {
  bookingType: string;
  isEmergency: boolean;
  noticeLabel: string;
  serviceDurationMinutes: number;
  reservedDurationMinutes: number;
  appointmentStartAt: string;
  appointmentEndAt: string;
  reservedUntilAt: string;
  lines: PriceLine[];
  totalMinor: number;
}

/**
 * The single confirm step (§C-07), for a customer who already chose.
 *
 * Search hands over a vendor, a service and a real start time, so re-asking
 * all three would be asking twice. What is left is the part that genuinely
 * cannot be answered earlier: where to come, anything the vendor should know,
 * and the authorisation itself.
 *
 * The price shown here is not carried from the results page. It was recomputed
 * on the server for this exact slot moments ago, which is also what re-checked
 * that the slot still exists — a marketplace loses slots between the list and
 * the confirm, and that has to be caught before the money, not after.
 */
export function ConfirmBooking({
  hubId,
  serviceId,
  serviceName,
  providerName,
  sector,
  customerId,
  customerName,
  imageUploadsEnabled,
  thresholdHours,
  quote,
}: {
  hubId: string;
  serviceId: string;
  serviceName: string;
  providerName: string | null;
  sector: string;
  customerId: string | null;
  customerName: string;
  imageUploadsEnabled: boolean;
  thresholdHours: number;
  quote: ConfirmQuote;
}) {
  const router = useRouter();
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const addressLine = formatAddress(address);
  const [notes, setNotes] = useState("");
  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The card step: shown once the booking exists, until Stripe has the card.
  const [hold, setHold] = useState<{
    id: string;
    bookingType: string;
    clientSecret: string;
    mode: "payment" | "setup";
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    bookingType: string;
  } | null>(null);

  const items = [
    serviceItem({ id: serviceId, name: serviceName, priceMinor: quote.totalMinor, city: sector, vendor: providerName }),
  ];

  const submit = async () => {
    if (!customerId) return;
    setSubmitting(true);
    setError(null);
    track("begin_checkout", {
      currency: CURRENCY,
      value: toMajor(quote.totalMinor),
      items,
      booking_channel: "search_offer",
      booking_type: quote.bookingType.toLowerCase(),
    });
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hubId,
          serviceIds: [serviceId],
          appointmentStartAt: quote.appointmentStartAt,
          customerId,
          addressLine,
          notes,
          referenceImageUrl: referenceImage?.url ?? "",
          referenceImageFileId: referenceImage?.fileId ?? "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Could not place the booking.",
        );
      }
      if (payload.payment?.kind === "card") {
        setHold({
          id: payload.booking.id,
          bookingType: payload.booking.bookingType,
          clientSecret: payload.payment.clientSecret,
          mode: payload.payment.mode,
        });
      } else {
        trackBookingPlaced({
          bookingId: payload.booking.id,
          channel: "search_offer",
          items,
          totalMinor: quote.totalMinor,
          bookingType: payload.booking.bookingType,
          cardAuthorised: false,
        });
        setConfirmation({
          id: payload.booking.id,
          bookingType: payload.booking.bookingType,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not place the booking.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <SearchingForProvider
        bookingId={confirmation.id}
        bookingType={confirmation.bookingType}
        sector={sector}
        // Back to the offer list, NOT back to this form. The booking already
        // exists by now — re-showing a confirm button would let the same
        // customer place it a second time while the first is still out.
        onTryAnotherTime={() => router.push("/search")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {quote.isEmergency ? (
        <div className="overflow-hidden rounded-glam border border-emergency/30 bg-surface">
          <div className="flex items-start gap-3 bg-emergency-soft px-4 py-3">
            <span
              aria-hidden
              className="breathe-emergency mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emergency text-on-emergency"
            >
              <Lightning size={16} weight="fill" />
            </span>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-emergency-ink">
                Emergency
              </p>
              <p className="mt-1 text-[15px] text-ink">
                You are booking {quote.noticeLabel} ahead, inside our{" "}
                {thresholdHours}-hour window, so the emergency rate below
                applies.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              {formatCustomerDayTime(quote.appointmentStartAt)}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {serviceName}
              {providerName ? ` · ${providerName}` : ""} · {sector}
            </p>
          </div>
          <BookingTypeTag bookingType={quote.bookingType} />
        </div>

        <DurationStrip
          className="mt-3"
          serviceLabel={`${formatDuration(quote.serviceDurationMinutes)} services`}
          transitionMinutes={15}
          blockLabel={`${formatCustomerTime(quote.appointmentStartAt)}–${formatCustomerTime(quote.reservedUntilAt)}`}
        />

        {/* Every line, always. Nothing collapsed behind a disclosure, and no
            surcharge left unnamed. */}
        <dl className="mt-4 space-y-1.5">
          {quote.lines.map((line) => (
            <div
              key={line.key}
              className={`flex items-baseline justify-between gap-4 text-sm ${
                line.emphasis === "emergency"
                  ? "font-bold text-emergency-ink"
                  : "text-ink"
              }`}
            >
              <dt>{line.label}</dt>
              <dd data-numeric className="text-right">
                {formatMoney(line.amountMinor)}
              </dd>
            </div>
          ))}
          <div
            className={`flex items-baseline justify-between gap-4 border-t border-line pt-3 ${
              quote.isEmergency ? "text-emergency-ink" : "text-ink"
            }`}
          >
            <dt className="text-base font-bold">Total</dt>
            <dd
              data-numeric
              className={`text-right text-xl font-bold ${
                quote.isEmergency ? "" : "text-accent-700"
              }`}
            >
              {formatMoney(quote.totalMinor)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-sm text-ink-muted">
          Booking as <span className="font-medium text-ink">{customerName}</span>
        </p>

        <div>
          <AddressFields value={address} onChange={setAddress} />
          <p className="mt-1 text-xs text-ink-muted">Only released to your vendor once they are on their way.</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">
            Notes <span className="text-ink-muted">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
          />
        </label>

        {imageUploadsEnabled ? (
          <ImageUpload
            folder="reference"
            value={referenceImage}
            onChange={setReferenceImage}
            label="Reference photo (optional)"
            hint="Show the look you want, so your vendor arrives prepared."
            disabled={submitting}
          />
        ) : null}
      </Card>

      <CancellationTerms appointmentStartAt={quote.appointmentStartAt} />

      {hold ? (
        <Card className="space-y-3 p-4">
          <p className="font-display font-semibold text-ink">Add your card</p>
          <CardHold
            bookingId={hold.id}
            clientSecret={hold.clientSecret}
            amountMinor={quote.totalMinor}
            mode={hold.mode}
            onAuthorised={() => {
              trackBookingPlaced({
                bookingId: hold.id,
                channel: "search_offer",
                items,
                totalMinor: quote.totalMinor,
                bookingType: hold.bookingType,
                cardAuthorised: true,
              });
              setConfirmation({ id: hold.id, bookingType: hold.bookingType });
            }}
          />
          <p className="text-xs text-ink-muted">
            Your request goes out to vendors as soon as your card is in place.
          </p>
        </Card>
      ) : (
        <Button
          variant={quote.isEmergency ? "emergency" : "primary"}
          onClick={submit}
          disabled={submitting || !customerId}
          className="w-full"
        >
          {submitting
            ? "Just a moment…"
            : quote.isEmergency
              ? "Confirm emergency booking"
              : "Confirm booking"}
        </Button>
      )}

      <p className="text-center text-xs text-ink-muted">
        We hold {formatMoney(quote.totalMinor)} on your card and only take it
        when you give your vendor your PIN at the end of the appointment.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
