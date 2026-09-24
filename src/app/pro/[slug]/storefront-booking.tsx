"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightning, Plus, Sparkle } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { AddressFields, EMPTY_ADDRESS, addressComplete, formatAddress, type AddressValue } from "@/components/address-fields";
import { CardHold } from "@/components/card-hold";
import { crossSellFor } from "@/lib/domain/specialty-hubs";
import { formatDuration, formatMoney, formatTime, toDateInputValue } from "@/lib/format";

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

interface Quote {
  bookingType: string;
  lines: { key: string; label: string; amountMinor: number; emphasis?: string }[];
  tipMinor: number;
  discountMinor: number;
  chargeMinor: number;
  promo: { code: string; applied: boolean; label: string; message: string } | null;
}

const TIP_PRESETS = [0, 500, 1000, 2000];

/**
 * The adaptive service menu, calendar matrix and checkout (Directory §B,
 * Flow 1 steps 4–5), all against one named vendor.
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
  const [basket, setBasket] = useState<string[]>([]);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
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
  const [hold, setHold] = useState<{ bookingId: string; clientSecret: string } | null>(null);

  const chosen = menu.filter((item) => basket.includes(item.id));
  const hasService = chosen.some((item) => item.kind === "SERVICE");
  const duration = chosen.reduce((sum, item) => sum + item.durationMinutes, 0);

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

  const toggle = (id: string) => {
    setBasket((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    setStartAt(null);
  };

  // The calendar matrix: reload whenever the basket (its length) or day changes.
  useEffect(() => {
    if (!hasService) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/pro/${slug}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serviceIds: basket, date: new Date(`${date}T00:00`).toISOString() }),
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
  }, [slug, basket, date, hasService]);

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
    if (!request) return;
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
  }, [slug, request]);

  const checkout = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/pro/${slug}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not place the booking.");
      if (payload.authorised || !payload.clientSecret) {
        router.push(`/bookings/${payload.bookingId}`);
      } else {
        setHold({ bookingId: payload.bookingId, clientSecret: payload.clientSecret });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not place the booking.");
    } finally {
      setBusy(false);
    }
  };

  const services = menu.filter((item) => item.kind === "SERVICE");
  const addons = menu.filter((item) => item.kind === "ADDON");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <section>
        <SectionTitle hint="Tick everything you want in one appointment">Service menu</SectionTitle>
        <MenuTable items={services} basket={basket} onToggle={toggle} />
        {addons.length > 0 ? (
          <>
            <p className="mb-2 mt-5 text-sm font-medium text-ink">Add-ons</p>
            <MenuTable items={addons} basket={basket} onToggle={toggle} />
          </>
        ) : null}

        {/* In-basket cross-sell for bridal and MUA work. */}
        {bridalWithoutNails && (crossSell.length > 0 || nearbyNails.length > 0) ? (
          <div className="mt-5 rounded-glam border border-accent-500/40 bg-sunken p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkle size={16} weight="fill" className="text-accent-500" aria-hidden />
              Finish the look: a dry-treatment nail overlay
            </p>
            <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
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
                    <Plus size={12} weight="bold" aria-hidden /> Add to basket
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

      <section className="space-y-4 lg:sticky lg:top-20">
        <Card className="p-4">
          <SectionTitle hint={hasService ? formatDuration(duration) : undefined}>Pick a time</SectionTitle>
          {!hasService ? (
            <p className="text-sm text-ink-muted">Choose at least one service to see open times.</p>
          ) : (
            <>
              <input
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(event) => {
                  setDate(event.target.value);
                  setStartAt(null);
                }}
                className="min-h-11 rounded-glam-input border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent-500"
              />
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {slots === null ? (
                  <p className="col-span-full text-sm text-ink-muted">Loading…</p>
                ) : slots.length === 0 ? (
                  <p className="col-span-full text-sm text-ink-muted">
                    {providerName} is not working this day. Try another.
                  </p>
                ) : (
                  slots.map((slot) => (
                    <button
                      key={slot.startAt}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={startAt === slot.startAt}
                      onClick={() => setStartAt(slot.startAt)}
                      className={`min-h-11 rounded-glam-sm border text-sm transition disabled:cursor-not-allowed disabled:text-ink-muted/50 disabled:line-through ${
                        startAt === slot.startAt
                          ? "border-accent-500 bg-accent-500 font-bold text-metal-ink"
                          : "border-line bg-surface text-ink hover:border-accent-500"
                      }`}
                    >
                      {slot.bookingType === "EMERGENCY" && slot.available ? (
                        <Lightning size={10} weight="fill" className="mr-0.5 inline text-emergency" aria-label="Emergency rate" />
                      ) : null}
                      {formatTime(slot.startAt)}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </Card>

        {startAt ? (
          <Card className="space-y-4 p-4">
            {hasWorkspace && travelsToClients ? (
              <fieldset>
                <legend className="text-sm font-medium text-ink">Where</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["VENDOR_PREMISES", "I'll come to them", workspaceLabel],
                      ["CUSTOMER_ADDRESS", "Come to me", `+${formatMoney(travelFeeMinor)} travel`],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-glam-sm border p-3 ${
                        location === value ? "border-accent-500 bg-sunken" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={location === value}
                        onChange={() => setLocation(value)}
                      />
                      <span className="block text-sm font-semibold text-ink">{label}</span>
                      <span className="block text-xs text-ink-muted">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-ink-muted">
                {hasWorkspace ? `At ${providerName}'s ${workspaceLabel.toLowerCase()}.` : `${providerName} comes to you.`}
              </p>
            )}

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
                Tip <span className="text-ink-muted">— 100% goes to {providerName}</span>
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
            ) : null}

            {hold && quote ? (
              <CardHold
                bookingId={hold.bookingId}
                clientSecret={hold.clientSecret}
                amountMinor={quote.chargeMinor}
                onAuthorised={() => router.push(`/bookings/${hold.bookingId}`)}
              />
            ) : signedInAsCustomer ? (
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

            <p className="text-center text-xs text-ink-muted">
              Nothing is taken now. The amount is held on your card and released to{" "}
              {providerName} only when you give them your 4-digit PIN at the end.
            </p>
          </Card>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function MenuTable({
  items,
  basket,
  onToggle,
}: {
  items: MenuItem[];
  basket: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-glam border border-line bg-surface">
      {items.map((item) => {
        const selected = basket.includes(item.id);
        return (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-sunken">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(item.id)}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--glam-champagne-500)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{item.name}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-sm text-ink-muted">{item.description}</span>
                ) : null}
                <span className="mt-1 block text-xs text-ink-muted">
                  {item.category} · {formatDuration(item.durationMinutes)}
                </span>
              </span>
              <span data-numeric className="shrink-0 text-[15px] font-bold text-ink">
                {formatMoney(item.priceMinor)}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
