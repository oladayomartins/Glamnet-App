"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Info, Lightning, Plus, Sparkle, X } from "@phosphor-icons/react";
import { Button, SectionTitle } from "@/components/ui";
import { AddressFields, EMPTY_ADDRESS, addressComplete, formatAddress, type AddressValue } from "@/components/address-fields";
import { CardHold } from "@/components/card-hold";
import { CancellationTerms } from "@/components/cancellation-terms";
import { crossSellFor, menuGroup, menuGroups } from "@/lib/domain/specialty-hubs";
import { featuredMenu } from "@/lib/domain/featured-menu";
import { FREE_CANCELLATION_HOURS } from "@/lib/domain/cancellation";
import { ukParts } from "@/lib/domain/uk-time";
import { formatDuration, formatMoney, formatTime } from "@/lib/format";
import {
  CURRENCY,
  daysAhead,
  serviceItem,
  toMajor,
  track,
  trackBookingPlaced,
  type BookingSource,
} from "@/lib/analytics";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "SERVICE" | "ADDON";
  priceMinor: number;
  durationMinutes: number;
}

interface Slot {
  startAt: string;
  available: boolean;
  bookingType: string;
}

interface Day {
  /** "YYYY-MM-DD" */
  date: string;
  status: "closed" | "full" | "free";
  firstStartAt: string | null;
}

interface Quote {
  bookingType: string;
  lines: { key: string; label: string; amountMinor: number; emphasis?: string }[];
  tipMinor: number;
  discountMinor: number;
  chargeMinor: number;
  promo: { code: string; applied: boolean; label: string; message: string } | null;
}

const TIP_PRESETS = [0, 500, 1000, 2000];

/** "2026-09-28" read as that calendar day, never shifted by a time zone. */
function dayParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const local = new Date(year, month - 1, day);
  return {
    weekday: local.toLocaleDateString("en-GB", { weekday: "short" }),
    day,
    month: local.toLocaleDateString("en-GB", { month: "long" }),
  };
}

/**
 * The storefront's service menu and booking (Directory §B, Flow 1 steps 4–5),
 * against one named vendor.
 *
 * Built for a phone: services are added with big Add buttons, filtered by
 * category, with each add-on offered under the service it goes with. A bar
 * along the bottom keeps the running total and "Choose a time" in reach, and
 * choosing a time happens in a sheet that opens on the first free day —
 * never on a day the vendor can't take the job. Checkout follows in the
 * same sheet.
 *
 * Every figure on the price card comes back from the server; nothing is
 * summed here beyond the running basket total shown while choosing.
 */
export function StorefrontBooking({
  slug,
  providerName,
  menu,
  source,
  hasWorkspace,
  workspaceLabel,
  travelsToClients,
  travelFeeMinor,
  nearbyNails,
  signedInAsCustomer,
  vendorArea,
}: {
  /** The centre of the pro's area (public, approximate). */
  vendorArea?: { lat: number; lng: number } | null;
  slug: string;
  providerName: string;
  menu: MenuItem[];
  source: "MARKETPLACE" | "DIRECT_LINK";
  hasWorkspace: boolean;
  workspaceLabel: string;
  travelsToClients: boolean;
  travelFeeMinor: number;
  nearbyNails: { name: string; slug: string }[];
  signedInAsCustomer: boolean;
}) {
  const router = useRouter();
  const firstName = providerName.trim().split(/\s+/)[0];
  const [basket, setBasket] = useState<string[]>([]);
  const [group, setGroup] = useState("All");
  /** "See all" has been tapped. Resets whenever the category changes. */
  const [expanded, setExpanded] = useState(false);

  const sheet = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"time" | "details" | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [location, setLocation] = useState<"VENDOR_PREMISES" | "CUSTOMER_ADDRESS">(
    hasWorkspace ? "VENDOR_PREMISES" : "CUSTOMER_ADDRESS",
  );
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const addressLine = formatAddress(address);
  const [notes, setNotes] = useState("");
  const [tipMinor, setTipMinor] = useState(0);
  // What is typed, and what has been sent for pricing. Only an applied code
  // travels with the checkout.
  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [promoNote, setPromoNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ bookingId: string; clientSecret: string; mode: "payment" | "setup" } | null>(null);

  const chosen = menu.filter((item) => basket.includes(item.id));
  const hasService = chosen.some((item) => item.kind === "SERVICE");
  const duration = chosen.reduce((sum, item) => sum + item.durationMinutes, 0);
  const basketTotal = chosen.reduce((sum, item) => sum + item.priceMinor, 0);
  const basketKey = basket.join(",");

  const services = menu.filter((item) => item.kind === "SERVICE");
  const addons = menu.filter((item) => item.kind === "ADDON");
  const groups = menuGroups(services.map((item) => item.category));
  const inGroup = group === "All" ? services : services.filter((item) => menuGroup(item.category) === group);

  // A long menu pushes reviews, hours and everything else below three screens.
  // Only the "All" tab collapses: picking a category is already the customer
  // narrowing the list, and truncating their choice as well would hide the
  // thing they just asked to see.
  const lead = featuredMenu(inGroup);
  const collapsible = group === "All" && !expanded && lead.hiddenCount > 0;
  const shownServices = collapsible ? lead.featured : inGroup;

  // Each add-on is offered once, under the first added service in its own
  // category ("Goes well with…"). Add-ons with no service in their category
  // on this menu are listed on their own as extras.
  const serviceCategories = new Set(services.map((item) => item.category));
  const extras = addons.filter((item) => !serviceCategories.has(item.category));
  const hostOf = (category: string) => chosen.find((item) => item.kind === "SERVICE" && item.category === category)?.id;

  // Bridal basket without nails → recommend this vendor's dry-treatment
  // overlays before checkout.
  const crossSell = crossSellFor(
    chosen.map((item) => item.category),
    menu,
    basket,
  );
  const bridalWithoutNails =
    chosen.some((item) => item.category === "MUA Glam & Asian Bridal") &&
    !chosen.some((item) => item.category === "Manicures & Pedicures");

  const bookingSource: BookingSource = source === "MARKETPLACE" ? "marketplace" : "direct_link";
  const analyticsItem = (item: MenuItem) => serviceItem({ ...item, vendor: providerName });
  // A promo result is reported once per code, not on every re-quote.
  const trackedPromo = useRef("");

  const toggle = (id: string) => {
    const item = menu.find((entry) => entry.id === id);
    if (item) {
      track(basket.includes(id) ? "remove_from_cart" : "add_to_cart", {
        currency: CURRENCY,
        value: toMajor(item.priceMinor),
        items: [analyticsItem(item)],
      });
    }
    setBasket((current) => {
      if (!current.includes(id)) return [...current, id];
      const next = current.filter((entry) => entry !== id);
      // Removing the last service in a category takes its add-ons with it:
      // a gel removal with no nail service left makes no sense.
      if (item?.kind !== "SERVICE") return next;
      const stillHosted = (category: string) =>
        next.some((entry) => menu.find((m) => m.id === entry && m.kind === "SERVICE" && m.category === category));
      return next.filter((entry) => {
        const other = menu.find((m) => m.id === entry);
        return !(other?.kind === "ADDON" && other.category === item.category && !stillHosted(item.category));
      });
    });
    setStartAt(null);
  };

  const openSheet = () => {
    setStep("time");
    setError(null);
    sheet.current?.showModal();
  };

  // The day picker: the next two weeks for this basket, opening on the first
  // free day rather than on today regardless.
  useEffect(() => {
    if (step === null || !hasService) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/pro/${slug}/days`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serviceIds: basketKey.split(",") }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load open days.");
        const loaded = payload.days as Day[];
        setDays(loaded);
        setDate((current) =>
          current && loaded.some((day) => day.date === current && day.status === "free")
            ? current
            : (loaded.find((day) => day.status === "free")?.date ?? null),
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setDays([]);
          setError(cause instanceof Error ? cause.message : "Could not load open days.");
        }
      }
    })();
    return () => controller.abort();
  }, [slug, basketKey, step, hasService]);

  // The times on the chosen day. The day travels as "YYYY-MM-DD" so the
  // server reads the same calendar day the customer tapped.
  useEffect(() => {
    if (step === null || !hasService || !date) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/pro/${slug}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serviceIds: basketKey.split(","), date }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load times.");
        setSlots(payload.slots);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setSlots([]);
          setError(cause instanceof Error ? cause.message : "Could not load times.");
        }
      }
    })();
    return () => controller.abort();
  }, [slug, basketKey, date, step, hasService]);

  const request = useMemo(
    () =>
      startAt
        ? {
            serviceIds: basket,
            appointmentStartAt: startAt,
            source,
            serviceLocation: location,
            tipMinor,
            addressLine,
            notes,
            ...(appliedCode ? { promoCode: appliedCode } : {}),
          }
        : null,
    [basket, startAt, source, location, tipMinor, addressLine, notes, appliedCode],
  );

  // The single transparent price card, recomputed on the server.
  useEffect(() => {
    if (!request || step !== "details") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/pro/${slug}/quote`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not price this.");
        setQuote(payload);
        setError(null);
        if (payload.promo) {
          if (trackedPromo.current !== payload.promo.code) {
            trackedPromo.current = payload.promo.code;
            track("apply_promo_code", { coupon: payload.promo.code, success: payload.promo.applied });
          }
          setPromoNote({
            ok: payload.promo.applied,
            text: payload.promo.applied
              ? `${payload.promo.code} · ${payload.promo.label}. ${payload.promo.message}`
              : payload.promo.message,
          });
          // A refused code is dropped, so the booking itself is never blocked.
          if (!payload.promo.applied) setAppliedCode("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setQuote(null);
          setError(cause instanceof Error ? cause.message : "Could not price this.");
        }
      }
    })();
    return () => controller.abort();
  }, [slug, request, step]);

  const checkout = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    const items = chosen.map(analyticsItem);
    const coupon = quote?.promo?.applied ? quote.promo.code : undefined;
    track("begin_checkout", {
      currency: CURRENCY,
      value: toMajor(quote?.chargeMinor ?? 0),
      items,
      booking_channel: "storefront",
      booking_source: bookingSource,
      ...(quote ? { booking_type: quote.bookingType.toLowerCase() } : {}),
      ...(coupon ? { coupon } : {}),
    });
    try {
      const response = await fetch(`/api/pro/${slug}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not place the booking.");
      if (payload.authorised || !payload.clientSecret) {
        trackBookingPlaced({
          bookingId: payload.bookingId,
          channel: "storefront",
          source: bookingSource,
          items,
          totalMinor: quote?.chargeMinor ?? 0,
          bookingType: quote?.bookingType,
          cardAuthorised: false,
          coupon,
          tipMinor: quote?.tipMinor,
        });
        router.push(`/bookings/${payload.bookingId}`);
      } else {
        setHold({ bookingId: payload.bookingId, clientSecret: payload.clientSecret, mode: payload.cardMode ?? "payment" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not place the booking.");
    } finally {
      setBusy(false);
    }
  };

  const serviceCount = chosen.length;
  const summary = `${serviceCount} ${serviceCount === 1 ? "service" : "services"} · ${formatDuration(duration)}`;
  const travelling = location === "CUSTOMER_ADDRESS" && hasWorkspace && travelsToClients;
  const chosenDay = date ? dayParts(date) : null;
  const slotGroups = groupSlots(slots ?? []);
  const endAt = startAt ? new Date(Date.parse(startAt) + duration * 60_000).toISOString() : null;

  return (
    <div>
      <section>
        <SectionTitle hint="Add everything you want in one appointment">Services</SectionTitle>

        {groups.length > 1 ? (
          <nav
            aria-label="Service categories"
            className="rail sticky top-[68px] z-10 -mx-4 mb-2 flex gap-2 overflow-x-auto border-b border-line bg-canvas px-4 py-2.5"
          >
            {["All", ...groups].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={group === name}
                onClick={() => {
                  setGroup(name);
                  setExpanded(false);
                }}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-[180ms] ${
                  group === name ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink hover:border-accent-500"
                }`}
              >
                {name}
              </button>
            ))}
          </nav>
        ) : null}

        {collapsible && lead.pinned ? (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Featured
          </p>
        ) : null}

        <ul className="divide-y divide-line">
          {shownServices.map((item) => {
            const added = basket.includes(item.id);
            const suggestions = added && hostOf(item.category) === item.id
              ? addons.filter((addon) => addon.category === item.category)
              : [];
            return (
              <li key={item.id} className="py-4">
                <MenuRow item={item} added={added} onToggle={() => toggle(item.id)} />
                {suggestions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {suggestions.map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center gap-3 rounded-glam-sm border border-accent-500/40 bg-sunken px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent-700">Goes well with</p>
                          <p className="text-sm font-semibold text-ink">
                            {addon.name}{" "}
                            <span data-numeric className="font-medium text-ink-muted">
                              · +{formatMoney(addon.priceMinor)} · {formatDuration(addon.durationMinutes)}
                            </span>
                          </p>
                        </div>
                        <AddButton added={basket.includes(addon.id)} name={addon.name} onClick={() => toggle(addon.id)} small />
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
          {group === "All"
            ? extras.map((item) => (
                <li key={item.id} className="py-4">
                  <MenuRow item={item} added={basket.includes(item.id)} onToggle={() => toggle(item.id)} extra />
                </li>
              ))
            : null}
        </ul>

        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition duration-[180ms] ease-glam hover:border-accent-500"
          >
            {/* Counts only what this button reveals: add-ons live in their
                own section below and are not hidden by it. */}
            See all {inGroup.length} services
          </button>
        ) : null}

        {/* In-basket cross-sell for bridal and MUA work. */}
        {bridalWithoutNails && (crossSell.length > 0 || nearbyNails.length > 0) ? (
          <div className="mt-5 rounded-glam border border-accent-500/40 bg-sunken p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkle size={16} weight="fill" className="text-accent-500" aria-hidden />
              Finish the look: a dry-treatment nail overlay
            </p>
            <div className="rail -mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {crossSell.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="min-w-44 snap-start rounded-glam-sm border border-line bg-surface p-3 text-left transition hover:border-accent-500"
                >
                  <span className="block text-sm font-semibold text-ink">{item.name}</span>
                  <span data-numeric className="mt-1 block text-xs text-ink-muted">
                    {formatMoney(item.priceMinor)} · {formatDuration(item.durationMinutes)}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-700">
                    <Plus size={12} weight="bold" aria-hidden /> Add
                  </span>
                </button>
              ))}
              {crossSell.length === 0
                ? nearbyNails.map((vendor) => (
                    <Link
                      key={vendor.slug}
                      href={`/pro/${vendor.slug}?via=directory`}
                      className="min-w-44 snap-start rounded-glam-sm border border-line bg-surface p-3 text-sm text-ink transition hover:border-accent-500"
                    >
                      <span className="block font-semibold">{vendor.name}</span>
                      <span className="mt-1 block text-xs text-ink-muted">Nail overlays nearby →</span>
                    </Link>
                  ))
                : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* --- The running total, always in reach ------------------------- */}
      {basket.length > 0 ? (
        <div
          data-booking-bar
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-card backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-[var(--glam-page-max)] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p data-numeric className="text-lg font-bold text-ink">
                {formatMoney(basketTotal)}
              </p>
              <p className="truncate text-sm text-ink-muted">{hasService ? summary : "Add a service to book"}</p>
            </div>
            <button
              type="button"
              onClick={openSheet}
              disabled={!hasService}
              className="inline-flex min-h-[3.25rem] shrink-0 items-center rounded-glam bg-ink px-5 text-base font-bold text-canvas transition duration-[180ms] disabled:opacity-40"
            >
              Choose a time
            </button>
          </div>
        </div>
      ) : null}

      {/* --- Pick a time, then checkout: one sheet ------------------------ */}
      <dialog
        ref={sheet}
        aria-label={step === "details" ? "Confirm your booking" : "Pick a time"}
        onClose={() => setStep(null)}
        onClick={(event) => {
          if (event.target === sheet.current) sheet.current?.close();
        }}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[22px] bg-canvas p-0 text-ink backdrop:bg-obsidian/60 sm:m-auto sm:max-h-[88dvh] sm:max-w-lg sm:rounded-glam"
      >
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[88dvh]">
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-line" />
          </div>
          <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-2">
            <div className="flex min-w-0 items-center gap-1">
              {step === "details" ? (
                <button
                  type="button"
                  onClick={() => setStep("time")}
                  aria-label="Back to times"
                  className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sunken"
                >
                  <ArrowLeft size={20} aria-hidden />
                </button>
              ) : null}
              <div className="min-w-0">
                <h2 className="font-display text-[22px] font-bold leading-tight">
                  {step === "details" ? "Confirm and book" : "Pick a time"}
                </h2>
                <p className="truncate text-sm text-ink-muted">
                  {chosen.filter((item) => item.kind === "SERVICE").map((item) => item.name).join(" + ")} ·{" "}
                  {formatDuration(duration)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => sheet.current?.close()}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sunken"
            >
              <X size={20} aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-2">
            {step === "time" ? (
              <>
                <section>
                  <h3 className="mb-2 text-[15px] font-bold">Where</h3>
                  {hasWorkspace && travelsToClients ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["VENDOR_PREMISES", `Visit ${firstName}`, workspaceLabel],
                          ["CUSTOMER_ADDRESS", "Come to me", `+${formatMoney(travelFeeMinor)} travel`],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={location === value}
                          onClick={() => {
                            setLocation(value);
                            setQuote(null);
                          }}
                          className={`min-h-[3.75rem] rounded-glam-sm border-[1.5px] px-3 py-2.5 text-left transition ${
                            location === value ? "border-accent-500 bg-sunken" : "border-line bg-surface"
                          }`}
                        >
                          <span className="block text-sm font-bold text-ink">{label}</span>
                          <span className="block text-xs text-ink-muted">{hint}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      {hasWorkspace ? `At ${firstName}'s ${lowerFirst(workspaceLabel)}.` : `${firstName} comes to you.`}
                    </p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-[15px] font-bold">{chosenDay?.month ?? "Day"}</h3>
                    <span className="text-xs text-ink-muted">Swipe for more days</span>
                  </div>
                  {days === null ? (
                    <p className="text-sm text-ink-muted">Loading days…</p>
                  ) : !days.some((day) => day.status === "free") ? (
                    <p className="rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
                      {firstName} has no free time for this in the next two weeks. Try fewer services, or check back soon.
                    </p>
                  ) : (
                    <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {days.map((day) => {
                        const parts = dayParts(day.date);
                        const on = day.date === date;
                        const off = day.status !== "free";
                        return (
                          <button
                            key={day.date}
                            type="button"
                            disabled={off}
                            aria-pressed={on}
                            aria-label={`${parts.weekday} ${parts.day} ${parts.month}${off ? `, ${day.status}` : ""}`}
                            onClick={() => {
                              setDate(day.date);
                              setSlots(null);
                              setStartAt(null);
                            }}
                            className={`flex h-[4.625rem] w-[3.625rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-glam-sm border-[1.5px] transition ${
                              on
                                ? "border-ink bg-ink text-canvas"
                                : off
                                  ? "border-line bg-sunken text-ink-muted/70"
                                  : "border-line bg-surface text-ink hover:border-accent-500"
                            }`}
                          >
                            <span className="text-xs font-semibold">{parts.weekday}</span>
                            <span data-numeric className="text-lg font-bold">{parts.day}</span>
                            <span className="text-[10px] font-semibold">
                              {day.status === "closed" ? "Closed" : day.status === "full" ? "Full" : on ? "Selected" : "Free"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {date ? (
                  <section className="space-y-3">
                    {slots === null ? (
                      <p className="text-sm text-ink-muted">Loading times…</p>
                    ) : (
                      slotGroups.map(([label, group]) => (
                        <div key={label}>
                          <h3 className="mb-2 text-[15px] font-bold">{label}</h3>
                          <div className="grid grid-cols-4 gap-2">
                            {group.map((slot) => (
                              <button
                                key={slot.startAt}
                                type="button"
                                disabled={!slot.available}
                                aria-pressed={startAt === slot.startAt}
                                onClick={() => {
                                  track("select_time_slot", {
                                    booking_channel: "storefront",
                                    booking_type: slot.bookingType.toLowerCase(),
                                    days_ahead: daysAhead(slot.startAt),
                                  });
                                  setStartAt(slot.startAt);
                                }}
                                className={`min-h-11 rounded-glam-sm border-[1.5px] text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken disabled:text-ink-muted/60 disabled:line-through ${
                                  startAt === slot.startAt
                                    ? "border-ink bg-ink text-canvas"
                                    : "border-line bg-surface text-ink hover:border-accent-500"
                                }`}
                              >
                                {slot.bookingType === "EMERGENCY" && slot.available ? (
                                  <Lightning size={10} weight="fill" className="mr-0.5 inline text-emergency" aria-label="Emergency rate" />
                                ) : null}
                                {formatTime(slot.startAt)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                ) : null}

                {startAt ? (
                  <CancellationTerms appointmentStartAt={startAt} />
                ) : (
                  <p className="flex gap-2 rounded-glam-sm border border-line bg-surface p-3 text-[13px] leading-relaxed text-ink-muted">
                    <Info size={18} className="mt-px shrink-0" aria-hidden />
                    <span>
                      Free cancellation up to {FREE_CANCELLATION_HOURS} hours before your appointment. The exact address
                      is shared once your booking is confirmed.
                    </span>
                  </p>
                )}
              </>
            ) : step === "details" ? (
              <>
                <p className="rounded-glam-sm bg-sunken p-3 text-sm text-ink">
                  <span className="font-semibold">
                    {chosenDay ? `${chosenDay.weekday} ${chosenDay.day} ${chosenDay.month}` : ""}
                    {startAt && endAt ? ` · ${formatTime(startAt)}–${formatTime(endAt)}` : ""}
                  </span>
                  <span className="block text-ink-muted">
                    {travelling
                      ? `${firstName} comes to you`
                      : hasWorkspace
                        ? `At ${firstName}'s ${lowerFirst(workspaceLabel)}`
                        : `${firstName} comes to you`}
                  </span>
                </p>

                {location === "CUSTOMER_ADDRESS" ? (
                  <AddressFields
                    value={address}
                    onChange={setAddress}
                    from={vendorArea ? { ...vendorArea, name: providerName } : null}
                  />
                ) : null}

                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    Notes <span className="text-ink-muted">(optional)</span>
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-accent-500"
                  />
                </label>

                <fieldset>
                  <legend className="text-sm font-medium text-ink">
                    Tip <span className="text-ink-muted">— 100% goes to {firstName}</span>
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TIP_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        aria-pressed={tipMinor === amount}
                        onClick={() => setTipMinor(amount)}
                        className={`min-h-11 rounded-full border px-4 text-sm ${
                          tipMinor === amount ? "border-accent-500 bg-sunken font-semibold text-ink" : "border-line text-ink-muted"
                        }`}
                      >
                        {amount === 0 ? "No tip" : formatMoney(amount)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="promo-code" className="text-sm font-medium text-ink">
                    Promo code
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="promo-code"
                      value={promoInput}
                      onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (promoInput.trim()) setAppliedCode(promoInput.trim());
                        }
                      }}
                      placeholder="e.g. WELCOME10"
                      autoComplete="off"
                      spellCheck={false}
                      className="min-h-11 min-w-0 flex-1 rounded-glam-input border border-line bg-surface px-3 font-mono text-[15px] uppercase tracking-wider text-ink outline-none focus:border-accent-500"
                    />
                    {appliedCode && promoNote?.ok ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCode("");
                          setPromoInput("");
                          setPromoNote(null);
                        }}
                        className="min-h-11 rounded-full border border-line px-4 text-sm text-ink-muted hover:text-ink"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!promoInput.trim() || !request}
                        onClick={() => setAppliedCode(promoInput.trim())}
                        className="min-h-11 rounded-full border border-accent-500 px-4 text-sm font-semibold text-accent-700 transition hover:bg-accent-100/40 disabled:opacity-40"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {promoNote ? (
                    <p
                      role="status"
                      className={`rise-in mt-1.5 text-xs ${promoNote.ok ? "text-normal-ink" : "text-warning"}`}
                    >
                      {promoNote.text}
                    </p>
                  ) : null}
                </div>

                {quote ? (
                  <dl className="space-y-1.5 border-t border-line pt-3">
                    {quote.lines.map((line) => (
                      <div
                        key={line.key}
                        className={`flex justify-between gap-4 text-sm ${
                          line.emphasis === "emergency" ? "font-bold text-emergency-ink" : "text-ink"
                        }`}
                      >
                        <dt>{line.label}</dt>
                        <dd data-numeric>{formatMoney(line.amountMinor)}</dd>
                      </div>
                    ))}
                    {quote.tipMinor > 0 ? (
                      <div className="flex justify-between gap-4 text-sm text-ink">
                        <dt>Tip</dt>
                        <dd data-numeric>{formatMoney(quote.tipMinor)}</dd>
                      </div>
                    ) : null}
                    {quote.discountMinor > 0 ? (
                      <div className="flex justify-between gap-4 text-sm font-semibold text-normal-ink">
                        <dt>Promo {quote.promo?.code}</dt>
                        <dd data-numeric>−{formatMoney(quote.discountMinor)}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-4 border-t border-line pt-2">
                      <dt className="font-bold text-ink">Held on your card</dt>
                      <dd data-numeric className="text-xl font-bold text-accent-700">
                        {formatMoney(quote.chargeMinor)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-ink-muted">Working out your total…</p>
                )}

                {startAt ? <CancellationTerms appointmentStartAt={startAt} /> : null}

                {hold && quote ? (
                  <CardHold
                    bookingId={hold.bookingId}
                    clientSecret={hold.clientSecret}
                    amountMinor={quote.chargeMinor}
                    mode={hold.mode}
                    onAuthorised={() => {
                      trackBookingPlaced({
                        bookingId: hold.bookingId,
                        channel: "storefront",
                        source: bookingSource,
                        items: chosen.map(analyticsItem),
                        totalMinor: quote.chargeMinor,
                        bookingType: quote.bookingType,
                        cardAuthorised: true,
                        coupon: quote.promo?.applied ? quote.promo.code : undefined,
                        tipMinor: quote.tipMinor,
                      });
                      router.push(`/bookings/${hold.bookingId}`);
                    }}
                  />
                ) : null}

                <p className="text-center text-xs text-ink-muted">
                  Nothing is taken now. The amount is held on your card and released to {firstName} only when you
                  give them your 4-digit PIN at the end.
                </p>
              </>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
                {error}
              </p>
            ) : null}
          </div>

          {/* The sheet's own footer: what is chosen, and the next step. */}
          {step === "time" ? (
            <footer className="space-y-2.5 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink-muted">
                  {startAt && chosenDay && endAt
                    ? `${chosenDay.weekday} ${chosenDay.day} · ${formatTime(startAt)}–${formatTime(endAt)}`
                    : "Choose a start time"}
                </span>
                <span data-numeric className="text-lg font-bold text-ink">
                  {formatMoney(basketTotal)}
                  {travelling ? <span className="text-sm font-semibold text-ink-muted"> + travel</span> : null}
                </span>
              </div>
              <button
                type="button"
                disabled={!startAt}
                onClick={() => setStep("details")}
                className="min-h-[3.25rem] w-full rounded-glam bg-ink text-base font-bold text-canvas transition disabled:bg-sunken disabled:text-ink-muted"
              >
                {startAt ? "Continue" : "Choose a time to continue"}
              </button>
            </footer>
          ) : step === "details" && !hold ? (
            <footer className="border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {signedInAsCustomer ? (
                <Button
                  onClick={checkout}
                  disabled={busy || !quote || (location === "CUSTOMER_ADDRESS" && !addressComplete(address))}
                  className="w-full"
                >
                  {busy ? "Holding your slot…" : "Book and hold my card"}
                </Button>
              ) : (
                <Link
                  href={`/sign-in?next=${encodeURIComponent(`/pro/${slug}${source === "MARKETPLACE" ? "?via=directory" : ""}`)}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
                >
                  Sign in to book
                </Link>
              )}
            </footer>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

/** "Home salon in RM9" → "home salon in RM9": mid-sentence, postcode intact. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Morning, afternoon and evening, leaving out any group with no times at all. */
function groupSlots(slots: Slot[]): [string, Slot[]][] {
  const groups: [string, Slot[]][] = [
    ["Morning", []],
    ["Afternoon", []],
    ["Evening", []],
  ];
  for (const slot of slots) {
    const hour = ukParts(new Date(slot.startAt)).hour;
    groups[hour < 12 ? 0 : hour < 17 ? 1 : 2][1].push(slot);
  }
  return groups.filter(([, group]) => group.length > 0);
}

function MenuRow({
  item,
  added,
  onToggle,
  extra = false,
}: {
  item: MenuItem;
  added: boolean;
  onToggle: () => void;
  extra?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-ink">
          {item.name}
          {extra ? <span className="ml-2 text-xs font-semibold text-ink-muted">Extra</span> : null}
        </p>
        {item.description ? <p className="mt-0.5 text-sm text-ink-muted">{item.description}</p> : null}
        <p data-numeric className="mt-1 text-sm font-semibold text-ink">
          {formatMoney(item.priceMinor)}{" "}
          <span className="font-medium text-ink-muted">· {formatDuration(item.durationMinutes)}</span>
        </p>
      </div>
      <AddButton added={added} name={item.name} onClick={onToggle} />
    </div>
  );
}

function AddButton({
  added,
  name,
  onClick,
  small = false,
}: {
  added: boolean;
  name: string;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={added}
      aria-label={`${added ? "Remove" : "Add"} ${name}`}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-glam-sm border-[1.5px] border-ink font-bold transition duration-[180ms] ${
        small ? "min-w-[4.25rem] px-3 text-[13px]" : "min-w-[5rem] px-3.5 text-sm"
      } ${added ? "bg-ink text-canvas" : "bg-surface text-ink hover:bg-sunken"}`}
    >
      {added ? <Check size={14} weight="bold" aria-hidden /> : <Plus size={14} weight="bold" aria-hidden />}
      {added ? "Added" : "Add"}
    </button>
  );
}
