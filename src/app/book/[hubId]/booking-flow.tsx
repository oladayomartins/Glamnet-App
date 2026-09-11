"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, Lightning, Plus } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import {
  BookingTypeTag,
  Button,
  Card,
  DurationStrip,
  EmergencyBanner,
  EmptyState,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { SearchingForProvider } from "./searching";
import {
  describeSurcharge,
  formatCustomerTime,
  formatDay,
  formatDuration,
  formatMoney,
  toDateInputValue,
} from "@/lib/format";

/** The transition period appended to every booking. Mirrors the server. */
const TRANSITION_MINUTES = 15;
/** How far ahead the date strip runs. */
const DATE_STRIP_DAYS = 14;

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
 * The customer booking flow: service builder (§C-04), scheduling (§C-06) and
 * checkout (§C-07) on one scrolling screen.
 *
 * Nothing here decides anything commercial. The basket and the chosen time are
 * the only inputs; classification, duration and price all come back from the
 * server, which is what makes spec §12's "customer cannot override the
 * classification" true by construction rather than by convention.
 */
export function BookingFlow({
  hub,
  services,
  customerId,
  customerName,
  imageUploadsEnabled,
  thresholdMinutes,
  surchargeType,
  surchargeValue,
  initialServiceId,
}: {
  hub: Hub;
  services: Service[];
  customerId: string | null;
  customerName: string;
  imageUploadsEnabled: boolean;
  thresholdMinutes: number;
  surchargeType: string | null;
  surchargeValue: number | null;
  initialServiceId?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialServiceId && services.some((s) => s.id === initialServiceId)
      ? [initialServiceId]
      : [],
  );
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
  const [addressLine, setAddressLine] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null);
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
  const previewSubtotal = selected.reduce(
    (total, service) => total + service.priceMinor,
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
  // A day can be full rather than closed: the grid comes back with every
  // working-hours start time, all of them taken. That is a different message
  // from "nobody works then", and it needs its own way forward.
  const hasFreeSlot = slots.some((slot) => slot.providerCount > 0);

  const quoteKey =
    selectedSlot && selectedIds.length > 0
      ? `${hub.id}|${basketKey}|${selectedSlot}`
      : null;

  const quote =
    quoteKey && quoteResult?.key === quoteKey ? quoteResult.quote : null;

  /**
   * The selected slot's own classification, straight off the availability
   * response. The banner uses this rather than waiting for the quote, because
   * §C-06 requires the emergency warning the moment the slot is chosen — not
   * at checkout, once the customer has already committed.
   */
  const selectedSlotIsEmergency = slots.some(
    (slot) => slot.startAt === selectedSlot && slot.bookingType === "EMERGENCY",
  );

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
          referenceImageUrl: referenceImage?.url ?? "",
          referenceImageFileId: referenceImage?.fileId ?? "",
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

  // Once the request is placed there is nothing left to do on this screen, so
  // it becomes the searching state (§C-08) rather than a confirmation card
  // sitting on top of a form the customer can no longer use.
  if (confirmation) {
    return (
      <SearchingForProvider
        bookingId={confirmation.id}
        bookingType={confirmation.bookingType}
        sector={hub.sector}
        // Back to the picker with the basket still selected — only the slot
        // is cleared, since that is the one thing that did not work.
        onTryAnotherTime={() => {
          setConfirmation(null);
          setSelectedSlot(null);
        }}
      />
    );
  }

  const durationStrip =
    previewDuration > 0 ? (
      <DurationStrip
        serviceLabel={`${formatDuration(previewDuration)} services`}
        transitionMinutes={TRANSITION_MINUTES}
        blockLabel={
          quote
            ? `${formatCustomerTime(quote.appointmentStartAt)}–${formatCustomerTime(
                addMinutesIso(
                  quote.appointmentStartAt,
                  quote.reservedDurationMinutes,
                ),
              )}`
            : undefined
        }
      />
    ) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/search" className="tap-44 text-sm text-ink-muted hover:text-brand-700">
          ← All providers
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          {hub.name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {hub.city} · {hub.sector} ·{" "}
          <span data-numeric>{formatMoney(hub.travelFeeMinor)} travel fee</span>
        </p>
      </div>

      {/* ============ C-04 — service builder =========================== */}
      <section>
        <SectionTitle hint="Step 1 of 3">Build your appointment</SectionTitle>
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

        {addons.length > 0 ? (
          <div className="mt-4">
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

        {selected.length > 0 ? (
          <Card className="mt-4 p-4">
            <ul className="space-y-2">
              {selected.map((service) => (
                <li
                  key={service.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-ink">
                    {service.name}
                    <span className="ml-2 text-xs text-ink-muted">
                      {formatDuration(service.durationMinutes)}
                    </span>
                  </span>
                  <span data-numeric className="font-medium text-ink">
                    {formatMoney(service.priceMinor)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
              <span className="text-ink-muted">Subtotal</span>
              <span data-numeric className="font-semibold text-ink">
                {formatMoney(previewSubtotal)}
              </span>
            </div>
            {/* No total until a time is chosen: the travel fee and any
                emergency rate both depend on it, and a placeholder figure that
                later moves is worse than no figure at all. */}
            <p className="mt-1 text-xs text-ink-muted">
              Total calculated at scheduling
            </p>

            {durationStrip ? <div className="mt-3">{durationStrip}</div> : null}
          </Card>
        ) : null}
      </section>

      {/* ============ C-05 — reference upload (optional) =============== */}
      <section>
        <SectionTitle hint="Optional">Add a reference</SectionTitle>
        <Card className="p-4">
          {imageUploadsEnabled ? (
            <ImageUpload
              folder="reference"
              value={referenceImage}
              onChange={setReferenceImage}
              label="Reference photo"
              hint="Show the look you want, so your provider arrives prepared."
              disabled={submitting}
            />
          ) : (
            /* No media library configured: say so rather than showing a
               control that cannot work. */
            <p className="text-[15px] text-ink-muted">
              Photo uploads are unavailable right now. You can describe the look
              you want in the notes at checkout instead.
            </p>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            A clear photo of the finished look, in good light. Your provider
            sees it the moment they accept, so they arrive with the right kit.
            You can skip this and add one later.
          </p>
        </Card>
      </section>

      {/* ============ C-06 — date & time =============================== */}
      <section>
        <SectionTitle
          hint={
            previewDuration > 0
              ? `${formatDuration(previewDuration + TRANSITION_MINUTES)} reserved`
              : "Step 2 of 3"
          }
        >
          Pick a date and time
        </SectionTitle>

        <div className="space-y-4">
          <DateStrip
            value={date}
            onChange={(next) => {
              setDate(next);
              setSelectedSlot(null);
            }}
          />

          {selectedIds.length === 0 ? (
            <EmptyState
              icon={<Plus size={24} weight="light" />}
              title="Choose a service first"
            >
              Availability depends on how long your appointment runs, so pick
              what you want above and the real times will appear here.
            </EmptyState>
          ) : slotsLoading ? (
            <SlotGridSkeleton />
          ) : slots.length === 0 ? (
            <EmptyState
              icon={<Clock size={24} weight="light" />}
              title="No room on that day"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDate(shiftDate(date, 1));
                    setSelectedSlot(null);
                  }}
                  className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
                >
                  Try {formatDay(shiftDate(date, 1))}
                </button>
              }
            >
              Nobody in {hub.sector} can fit{" "}
              {formatDuration(previewDuration)} plus the 15-minute transition on{" "}
              {formatDay(date)}.
            </EmptyState>
          ) : (
            <>
              <SlotGrid
                slots={slots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />
              <SlotLegend />
              {!hasFreeSlot ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-glam border border-line bg-sunken p-4">
                  <p className="text-[15px] text-ink">
                    Every time on {formatDay(date)} is already committed.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(shiftDate(date, 1));
                      setSelectedSlot(null);
                    }}
                    className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink active:scale-[0.98]"
                  >
                    Try {formatDay(shiftDate(date, 1))}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* The banner appears on selection, not at checkout. */}
          {selectedSlotIsEmergency ? (
            <EmergencyBanner
              thresholdHours={thresholdHours}
              surchargeLabel={surchargeLabel}
            />
          ) : null}

          {durationStrip}
        </div>
      </section>

      {/* ============ C-07 — checkout & pre-auth ======================= */}
      <section>
        <SectionTitle hint="Step 3 of 3">Confirm and pay</SectionTitle>

        {!quote ? (
          <EmptyState icon={<Clock size={24} weight="light" />}>
            Pick a time above and your full price appears here, itemised, before
            anything is authorised.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              {quote.isEmergency ? (
                <div className="flex items-start gap-3 border-b border-emergency/25 bg-emergency-soft px-4 py-3">
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
              ) : null}

              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {formatDay(quote.appointmentStartAt)},{" "}
                      {formatCustomerTime(quote.appointmentStartAt)}–
                      {formatCustomerTime(quote.appointmentEndAt)}
                    </p>
                    <p className="text-xs text-ink-muted" data-numeric>
                      {formatDuration(quote.serviceDurationMinutes)} of services ·{" "}
                      {quote.noticeLabel} notice · {quote.providersAvailable}{" "}
                      provider{quote.providersAvailable === 1 ? "" : "s"} free
                    </p>
                  </div>
                  <BookingTypeTag bookingType={quote.bookingType} />
                </div>

                {/* Every line, always. Nothing is collapsed behind a
                    "details" disclosure and no surcharge is unnamed. */}
                <dl className="mt-3 space-y-1.5">
                  {quote.price.lines.map((line) => (
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
                      {formatMoney(quote.price.totalMinor)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <p className="text-sm text-ink-muted">
                Booking as{" "}
                <span className="font-medium text-ink">{customerName}</span>
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
              We pre-authorise {formatMoney(quote.price.totalMinor)} now and
              release it to your provider after the appointment is completed and
              rated.
            </p>
          </div>
        )}
      </section>

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

/**
 * The date strip (§C-06).
 *
 * `flex: 1 1 0` with `min-width: 0` on every cell is the whole trick: the
 * strip divides the width it has rather than summing the widths it wants, so
 * four or five days are visible at any size and it never overflows the screen.
 * Days already past are muted and disabled, not hidden.
 */
function DateStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: DATE_STRIP_DAYS }, (_, offset) => {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    return day;
  });

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="Appointment date"
    >
      {days.map((day) => {
        const key = toDateInputValue(day);
        const isSelected = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={isSelected}
            className={`min-h-[64px] min-w-[72px] shrink-0 grow basis-0 rounded-glam-sm px-2 py-2 text-center transition duration-[180ms] ease-glam active:scale-[0.98] ${
              isSelected
                ? "bg-metal text-metal-ink"
                : "bg-surface text-ink ring-1 ring-line hover:ring-brand-200"
            }`}
          >
            <span className="block text-[11px] font-medium uppercase tracking-wider opacity-75">
              {day.toLocaleDateString("en-GB", { weekday: "short" })}
            </span>
            <span data-numeric className="mt-0.5 block text-lg font-bold">
              {day.getDate()}
            </span>
            <span className="block text-[10px] uppercase tracking-wider opacity-75">
              {day.toLocaleDateString("en-GB", { month: "short" })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The time slot grid (§C-06).
 *
 * `auto-fit minmax(84px, 1fr)` with a 44px floor on every pill, and four
 * states that are each distinguishable without colour: the selected slot is
 * ringed, an emergency slot carries the bolt, and a slot nobody is free for is
 * struck through. Nothing here decides which state a slot is in — the server
 * already did.
 */
function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (startAt: string) => void;
}) {
  return (
    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]">
      {slots.map((slot) => {
        const isSelected = selected === slot.startAt;
        const isEmergency = slot.bookingType === "EMERGENCY";
        const isFree = slot.providerCount > 0;

        const tone = !isFree
          ? "bg-sunken text-ink-muted/70 line-through cursor-not-allowed"
          : isSelected
            ? "border-[1.5px] border-brand-700 bg-brand-50 text-brand-700"
            : isEmergency
              ? "border border-emergency/50 bg-emergency-soft text-emergency-ink"
              : "border border-line bg-surface text-ink hover:border-brand-400";

        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={!isFree}
            onClick={() => onSelect(slot.startAt)}
            aria-pressed={isSelected}
            aria-label={
              isFree
                ? `${formatCustomerTime(slot.startAt)}${isEmergency ? ", inside the emergency window" : ""}`
                : `${formatCustomerTime(slot.startAt)}, no provider free`
            }
            className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-glam-sm px-2 text-sm font-medium transition duration-[180ms] ease-glam active:scale-[0.98] ${tone}`}
          >
            {isFree && isEmergency ? (
              <Lightning size={13} weight="fill" aria-hidden />
            ) : null}
            <span data-numeric>{formatCustomerTime(slot.startAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Always rendered, even when no emergency slot happens to be on screen. */
function SlotLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-3 w-5 rounded-[4px] border-[1.5px] border-brand-700 bg-brand-50"
        />
        Selected
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="flex h-3 w-5 items-center justify-center rounded-[4px] border border-emergency/50 bg-emergency-soft text-emergency-ink"
        >
          <Lightning size={9} weight="fill" />
        </span>
        Inside 12h
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-5 rounded-[4px] bg-sunken" />
        <span className="line-through">No provider free</span>
      </li>
    </ul>
  );
}

/** The grid's loading state: the same footprint, shimmering. */
function SlotGridSkeleton() {
  return (
    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
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
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex items-start gap-3 rounded-glam border p-3 text-left transition duration-[180ms] ease-glam active:scale-[0.99] ${
        checked
          ? "border-brand-700 bg-brand-50"
          : "border-line bg-surface hover:border-brand-200"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          checked ? "bg-brand-700 text-on-brand" : "bg-sunken text-ink-muted"
        }`}
      >
        {checked ? <CheckCircle size={14} weight="fill" /> : <Plus size={12} />}
      </span>
      <span className="flex-1">
        <span className="flex justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{service.name}</span>
          <span data-numeric className="text-sm font-semibold text-ink">
            {formatMoney(service.priceMinor)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          {formatDuration(service.durationMinutes)} · {service.category}
        </span>
      </span>
    </button>
  );
}

/** "YYYY-MM-DD" shifted by whole days, staying in local time. */
function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + days);
  return toDateInputValue(shifted);
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
