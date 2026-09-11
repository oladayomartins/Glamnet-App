"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightning, MapPin, Star } from "@phosphor-icons/react";
import { GlamImage } from "@/components/glam-image";
import { formatCustomerDayTime, formatDuration, formatMoney } from "@/lib/format";

export interface OfferRow {
  providerId: string;
  providerName: string;
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  city: string;
  sector: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  reservedMinutes: number;
  hubId: string;
  /** ISO, because this crosses the server boundary. */
  startAt: string;
  bookingType: string;
  totalMinor: number;
  emergencySurchargeMinor: number;
}

/**
 * The results list (§C-02), as a set of offers to choose between.
 *
 * Modelled on picking a ride rather than browsing a directory: each row is one
 * person, one real start time and the price that time actually costs, and the
 * list is sorted by who can come soonest. Choosing is one tap, and the choice
 * stays visible in a bar at the bottom until it is confirmed.
 *
 * The prices are not estimates. Each came from the same pricing engine the
 * booking uses, at that row's own start time, so a row inside the emergency
 * window shows the surcharge in its total and says so — the customer sees the
 * classification and the real figure before they commit to anything, which is
 * the whole point of the rule.
 */
export function OfferList({ offers }: { offers: OfferRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const selected = offers.find((offer) => offer.providerId === selectedId);

  const confirm = () => {
    if (!selected) return;
    setGoing(true);
    // Straight to the confirm step, carrying the three things already chosen.
    // They are claims, not decisions: that page re-verifies the slot and
    // re-prices it server-side before anything is authorised.
    const query = new URLSearchParams({
      service: selected.serviceId,
      at: selected.startAt,
      provider: selected.providerId,
    });
    router.push(`/book/${selected.hubId}/confirm?${query.toString()}`);
  };

  return (
    <div className={selected ? "pb-28" : undefined}>
      <ul className="space-y-2">
        {offers.map((offer) => {
          const isSelected = offer.providerId === selectedId;
          const isEmergency = offer.bookingType === "EMERGENCY";

          return (
            <li key={offer.providerId}>
              <button
                type="button"
                onClick={() => setSelectedId(isSelected ? null : offer.providerId)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-4 rounded-glam border p-3 text-left transition duration-[180ms] ease-glam sm:p-4 ${
                  isSelected
                    ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700"
                    : "border-line bg-surface hover:border-brand-200"
                }`}
              >
                <GlamImage
                  src={offer.avatarUrl}
                  alt=""
                  width={128}
                  height={128}
                  className="h-14 w-14 shrink-0 rounded-glam-sm object-cover sm:h-16 sm:w-16"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-bold text-ink">
                      {offer.providerName}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs text-ink-muted"
                      data-numeric
                    >
                      <Star
                        size={11}
                        weight="fill"
                        className="text-accent-500"
                        aria-hidden
                      />
                      {offer.rating.toFixed(1)} ({offer.reviewCount})
                    </span>
                  </span>

                  <span className="mt-0.5 block truncate text-sm text-ink">
                    {offer.serviceName}
                  </span>

                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} weight="light" aria-hidden />
                      {offer.city} · {offer.sector}
                    </span>
                    <span aria-hidden>·</span>
                    <span data-numeric>
                      {formatDuration(offer.durationMinutes)} +15m
                    </span>
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  {/* The soonest this person can actually come, which is what
                      the list is sorted by and the reason to pick one row
                      over another. */}
                  <span
                    data-numeric
                    className={`block text-xs font-semibold ${
                      isEmergency ? "text-emergency-ink" : "text-normal-ink"
                    }`}
                  >
                    {isEmergency ? (
                      <span className="inline-flex items-center gap-1">
                        <Lightning size={11} weight="fill" aria-hidden />
                        {formatCustomerDayTime(offer.startAt)}
                      </span>
                    ) : (
                      formatCustomerDayTime(offer.startAt)
                    )}
                  </span>
                  <span
                    data-numeric
                    className="mt-1 block text-lg font-bold text-ink"
                  >
                    {formatMoney(offer.totalMinor)}
                  </span>
                  {offer.emergencySurchargeMinor > 0 ? (
                    <span
                      data-numeric
                      className="block text-[11px] font-semibold text-emergency-ink"
                    >
                      incl. {formatMoney(offer.emergencySurchargeMinor)}{" "}
                      emergency rate
                    </span>
                  ) : (
                    <span className="block text-[11px] text-ink-muted">
                      all in
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* The choice stays on screen until it is acted on, rather than being
          remembered only by a highlight halfway up a scrolled list. */}
      {selected ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[var(--glam-page-max)] items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {selected.providerName} · {selected.serviceName}
              </p>
              <p className="truncate text-xs text-ink-muted" data-numeric>
                {formatCustomerDayTime(selected.startAt)} ·{" "}
                {formatMoney(selected.totalMinor)}
                {selected.emergencySurchargeMinor > 0
                  ? " · emergency rate applies"
                  : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={going}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-bold transition duration-[180ms] ease-glam active:scale-[0.98] disabled:opacity-60 ${
                selected.bookingType === "EMERGENCY"
                  ? "bg-emergency text-on-emergency"
                  : "bg-metal text-metal-ink"
              }`}
            >
              {going ? "Opening…" : "Continue"}
              <ArrowRight size={15} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
