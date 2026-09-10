"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookingTypeTag,
  Button,
  Card,
  EmergencyNotice,
  EmptyState,
  SectionTitle,
} from "@/components/ui";
import {
  describeSurcharge,
  formatDay,
  formatDuration,
  formatMoney,
  formatTime,
  toDateInputValue,
} from "@/lib/format";

interface Hub {
  id: string;
  name: string;
  sector: string;
  city: string;
  travelFeeMinor: number;
}

interface Service {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  durationMinutes: number;
  kind: string;
  category: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Slot {
  startAt: string;
  endAt: string;
  noticePeriodMinutes: number;
  bookingType: string;
  providerCount: number;
}

interface PriceLine {
  key: string;
  label: string;
  amountMinor: number;
  emphasis?: string;
}

interface Quote {
  bookingType: string;
  noticePeriodMinutes: number;
  noticeLabel: string;
  isEmergency: boolean;
  serviceDurationMinutes: number;
  reservedDurationMinutes: number;
  appointmentStartAt: string;
  appointmentEndAt: string;
  providersAvailable: number;
  price: {
    lines: PriceLine[];
    totalMinor: number;
    emergencySurchargeMinor: number;
  };
}

/**
 * The customer booking flow.
 *
 * Nothing here decides anything commercial. The basket and the chosen time are
 * the only inputs; classification, duration and price all come back from the
 * server, which is what makes spec §12's "customer cannot override the
 * classification" true by construction rather than by convention.
 */
export function BookingFlow({
  hub,
  services,
  customers,
  thresholdMinutes,
  surchargeType,
  surchargeValue,
}: {
  hub: Hub;
  services: Service[];
  customers: Customer[];
  thresholdMinutes: number;
  surchargeType: string | null;
  surchargeValue: number | null;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  // Slots follow the same key pattern as the quote: the loaded set is stored
  // with the request it answers, so "still loading" is derived rather than
  // tracked as a separate flag that can drift out of step.
  const [slotResult, setSlotResult] = useState<{
    key: string;
    slots: Slot[];
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  // The quote is stored with the request key it answers. Deriving visibility
  // from that key means a stale quote is never shown, and no effect has to
  // synchronously clear state to keep the screen honest.
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote: Quote;
  } | null>(null);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [addressLine, setAddressLine] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    bookingType: string;
  } | null>(null);

  const thresholdHours = Math.round(thresholdMinutes / 60);
  const surchargeLabel =
    surchargeType && surchargeValue !== null
      ? describeSurcharge(surchargeType, surchargeValue)
      : undefined;

  const baseServices = services.filter((service) => service.kind !== "ADDON");
  const addons = services.filter((service) => service.kind === "ADDON");

  const selected = useMemo(
    () => services.filter((service) => selectedIds.includes(service.id)),
    [services, selectedIds],
  );

  // Local preview only — the server's figures are authoritative at checkout.
  const previewDuration = selected.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );

  const toggleService = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
    setSelectedSlot(null);
  };

  const basketKey = [...selectedIds].sort().join(",");

  const slotsKey =
    selectedIds.length > 0 ? `${hub.id}|${basketKey}|${date}` : null;

  const slots = slotsKey && slotResult?.key === slotsKey ? slotResult.slots : [];
  const slotsLoading = slotsKey !== null && slotResult?.key !== slotsKey;

  const quoteKey =
    selectedSlot && selectedIds.length > 0
      ? `${hub.id}|${basketKey}|${selectedSlot}`
      : null;

  const quote =
    quoteKey && quoteResult?.key === quoteKey ? quoteResult.quote : null;

  useEffect(() => {
    if (!slotsKey) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/availability", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ hubId: hub.id, serviceIds: selectedIds, date }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Could not load times.");
        }
        setSlotResult({ key: slotsKey, slots: payload.slots });
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setSlotResult({ key: slotsKey, slots: [] });
        setError(cause instanceof Error ? cause.message : "Could not load times.");
      }
    })();

    return () => controller.abort();
  }, [hub.id, selectedIds, date, slotsKey]);

  // Re-quote whenever the basket or the chosen time changes, so the price on
  // screen always matches what the server would charge.
  useEffect(() => {
    if (!quoteKey || !selectedSlot) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/bookings/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            hubId: hub.id,
            serviceIds: selectedIds,
            appointmentStartAt: selectedSlot,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Could not price this booking.");
        }
        setQuoteResult({ key: quoteKey, quote: payload.quote });
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "Could not price this booking.",
        );
      }
    })();

    return () => controller.abort();
  }, [hub.id, selectedIds, selectedSlot, quoteKey]);

  const submit = async () => {
    if (!selectedSlot || !customerId) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hubId: hub.id,
          serviceIds: selectedIds,
          appointmentStartAt: selectedSlot,
          customerId,
          addressLine,
          notes,
          referenceImageUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not place the booking.");
      setConfirmation({
        id: payload.booking.id,
        bookingType: payload.booking.bookingType,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not place the booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <Card className="p-6">
        <BookingTypeTag bookingType={confirmation.bookingType} />
        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          Request sent to providers
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your payment is pre-authorised and your request has been broadcast to
          the nearest available professionals. You will be notified as soon as
          one accepts.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/bookings/${confirmation.id}`}>
            <Button>Track this booking</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Book something else</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-brand-700">
          ← All hubs
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          {hub.name}
          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-xs font-semibold text-brand-700">
            {hub.sector}
          </span>
        </h1>
      </div>

      {/* --- Step 2: services ------------------------------------------- */}
      <section>
        <SectionTitle hint="Step 1 of 4">Choose your services</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {baseServices.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              checked={selectedIds.includes(service.id)}
              onToggle={() => toggleService(service.id)}
            />
          ))}
        </div>
      </section>

      {/* --- Steps 3–4: reference image and add-ons ---------------------- */}
      <section>
        <SectionTitle hint="Step 2 of 4">Add a reference & extras</SectionTitle>
        <Card className="space-y-4 p-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">
              Reference image URL{" "}
              <span className="text-ink-muted">(optional)</span>
            </span>
            <input
              type="url"
              value={referenceImageUrl}
              onChange={(event) => setReferenceImageUrl(event.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Share the look you want so your provider arrives prepared.
            </span>
          </label>

          {addons.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Premium add-ons</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {addons.map((service) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    checked={selectedIds.includes(service.id)}
                    onToggle={() => toggleService(service.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </section>

      {/* --- Step 5: date & time ----------------------------------------- */}
      <section>
        <SectionTitle
          hint={
            previewDuration > 0
              ? `${formatDuration(previewDuration)} of services selected`
              : "Step 3 of 4"
          }
        >
          Pick a date & time
        </SectionTitle>

        <Card className="space-y-4 p-4">
          <label className="block max-w-xs">
            <span className="text-sm font-medium text-ink">Appointment date</span>
            <input
              type="date"
              value={date}
              min={toDateInputValue(new Date())}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedSlot(null);
              }}
              className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>

          {selectedIds.length === 0 ? (
            <EmptyState>Choose at least one service to see available times.</EmptyState>
          ) : slotsLoading ? (
            <p className="text-sm text-ink-muted">Checking provider calendars…</p>
          ) : slots.length === 0 ? (
            <EmptyState>
              No provider can fit {formatDuration(previewDuration)} plus the
              15-minute transition period on {formatDay(date)}. Try another date.
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedSlot === slot.startAt;
                  const isEmergency = slot.bookingType === "EMERGENCY";
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      onClick={() => setSelectedSlot(slot.startAt)}
                      aria-pressed={isSelected}
                      className={`rounded-glam-sm border px-3 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-brand-700 bg-brand-700 text-white"
                          : isEmergency
                            ? "border-emergency/40 bg-emergency-soft text-emergency hover:border-emergency"
                            : "border-line bg-surface text-ink hover:border-brand-400"
                      }`}
                    >
                      {formatTime(slot.startAt)}
                      {isEmergency ? (
                        <span className="ml-1" aria-label="emergency window">
                          ⚡
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-muted">
                ⚡ marks times inside the {thresholdHours}-hour emergency window.
                Times already committed to another booking, including each
                provider&rsquo;s 15-minute transition period, are not shown.
              </p>
            </>
          )}
        </Card>
      </section>

      {/* --- Steps 6–10: classification, duration, price, checkout ------- */}
      <section>
        <SectionTitle hint="Step 4 of 4">Review & confirm</SectionTitle>

        {!quote ? (
          <EmptyState>Select a time to see your full price.</EmptyState>
        ) : (
          <div className="space-y-4">
            {quote.isEmergency ? (
              <EmergencyNotice
                thresholdHours={thresholdHours}
                surchargeLabel={surchargeLabel}
              />
            ) : null}

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {formatDay(quote.appointmentStartAt)},{" "}
                    {formatTime(quote.appointmentStartAt)}–
                    {formatTime(quote.appointmentEndAt)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDuration(quote.serviceDurationMinutes)} of services ·{" "}
                    {quote.noticeLabel} notice · {quote.providersAvailable}{" "}
                    provider{quote.providersAvailable === 1 ? "" : "s"} available
                  </p>
                </div>
                <BookingTypeTag bookingType={quote.bookingType} />
              </div>

              <dl className="mt-3 space-y-1.5">
                {quote.price.lines.map((line) => (
                  <div
                    key={line.key}
                    className={`flex justify-between gap-4 text-sm ${
                      line.emphasis === "emergency"
                        ? "font-semibold text-emergency"
                        : "text-ink"
                    }`}
                  >
                    <dt>{line.label}</dt>
                    <dd className="tabular-nums">{formatMoney(line.amountMinor)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {formatMoney(quote.price.totalMinor)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="space-y-3 p-4">
              <label className="block">
                <span className="text-sm font-medium text-ink">Booking as</span>
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-ink">Your address</span>
                <input
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                  placeholder="Street, town, postcode"
                  className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
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
                  className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
            </Card>

            <Button
              variant={quote.isEmergency ? "emergency" : "primary"}
              onClick={submit}
              disabled={submitting || !customerId}
              className="w-full"
            >
              {submitting
                ? "Authorising…"
                : `Authorise ${formatMoney(quote.price.totalMinor)} & request${
                    quote.isEmergency ? " emergency booking" : ""
                  }`}
            </Button>
            <p className="text-center text-xs text-ink-muted">
              Payment is pre-authorised now and released to your provider after
              the appointment is completed and rated.
            </p>
          </div>
        )}
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-emergency bg-emergency-soft p-3 text-sm text-emergency"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ServiceRow({
  service,
  checked,
  onToggle,
}: {
  service: Service;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-glam border p-3 transition ${
        checked
          ? "border-brand-700 bg-brand-50"
          : "border-line bg-surface hover:border-brand-200"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 accent-[var(--glam-plum-700)]"
      />
      <span className="flex-1">
        <span className="flex justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{service.name}</span>
          <span className="text-sm font-semibold tabular-nums text-ink">
            {formatMoney(service.priceMinor)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          {formatDuration(service.durationMinutes)} · {service.category}
        </span>
      </span>
    </label>
  );
}
