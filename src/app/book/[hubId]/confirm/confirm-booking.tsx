"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightning } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { BookingTypeTag, Button, Card, DurationStrip } from "@/components/ui";
import { SearchingForProvider } from "../searching";
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
 * Search hands over a provider, a service and a real start time, so re-asking
 * all three would be asking twice. What is left is the part that genuinely
 * cannot be answered earlier: where to come, anything the provider should know,
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
  const [addressLine, setAddressLine] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    bookingType: string;
  } | null>(null);

  const submit = async () => {
    if (!customerId) return;
    setSubmitting(true);
    setError(null);
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
      setConfirmation({
        id: payload.booking.id,
        bookingType: payload.booking.bookingType,
      });
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

        <label className="block">
          <span className="text-sm font-medium text-ink">Your address</span>
          <input
            value={addressLine}
            onChange={(event) => setAddressLine(event.target.value)}
            placeholder="Street, town, postcode"
            className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Only released to your provider once they are on their way.
          </span>
        </label>

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
            hint="Show the look you want, so your provider arrives prepared."
            disabled={submitting}
          />
        ) : null}
      </Card>

      <Button
        variant={quote.isEmergency ? "emergency" : "primary"}
        onClick={submit}
        disabled={submitting || !customerId}
        className="w-full"
      >
        {submitting
          ? "Authorising…"
          : quote.isEmergency
            ? "Confirm emergency booking"
            : "Confirm booking"}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        We pre-authorise {formatMoney(quote.totalMinor)} now and release it to
        your provider after the appointment is completed and rated.
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
