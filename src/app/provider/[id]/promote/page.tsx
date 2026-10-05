import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone } from "@phosphor-icons/react/dist/ssr";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { formatDay, formatMoney } from "@/lib/format";
import { PROMOTION_WHERE, promotionState, type PromotionKey } from "@/lib/domain/promotions";
import { abandonPromotionCheckout, confirmPromotion, vendorPromotionOverview } from "@/lib/server/promotions";
import { requireVendorPage } from "../access";
import { BuyPromotion } from "./buy-promotion";

export const dynamic = "force-dynamic";

export const metadata = { title: "Promote" };

const STATE_LABEL = {
  PENDING: "Awaiting payment",
  SCHEDULED: "Booked",
  LIVE: "Live",
  ENDED: "Ended",
  EXPIRED: "Not paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
} as const;

/**
 * Paid promotions, from the vendor's side: what is on sale in their city,
 * how many slots are left, and what they have bought.
 *
 * Stripe sends the vendor back here with ?paid= or ?cancelled=. The paid
 * case is confirmed against Stripe on the spot rather than trusting the URL,
 * so the page shows the truth even if the webhook is still on its way.
 */
export default async function PromotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const { id } = await params;
  const { paid, cancelled } = await searchParams;
  const viewer = await requireVendorPage(id, `/provider/${id}/promote`);
  const isOwner = viewer.providerId === id;

  let notice: { tone: "positive" | "neutral"; text: string } | null = null;
  if (paid && isOwner) {
    const result = await confirmPromotion(paid).catch(() => "PENDING" as const);
    notice =
      result === "PAID"
        ? { tone: "positive", text: "Payment received. Your promotion is booked — see the dates below." }
        : result === "EXPIRED"
          ? { tone: "neutral", text: "That checkout ran out before it was paid, so nothing was charged." }
          : { tone: "neutral", text: "We're waiting for Stripe to confirm your payment. Refresh in a minute." };
  } else if (cancelled && isOwner) {
    await abandonPromotionCheckout(id, cancelled);
    notice = { tone: "neutral", text: "Checkout cancelled. Nothing was charged." };
  }

  const overview = await vendorPromotionOverview(id);
  if (!overview) notFound();
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provider/${id}/settings`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700">
          ← Profile &amp; settings
        </Link>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">Promote your storefront</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pay once to be seen first, for a set number of days. No subscription and nothing renews on its own. Clients
          see promoted spots marked <span className="font-semibold text-ink">Sponsored</span>.
        </p>
      </div>

      {notice ? (
        <p
          role="status"
          className={`rounded-glam px-4 py-3 text-sm ${
            notice.tone === "positive" ? "bg-normal-soft text-normal-ink ring-1 ring-normal/25" : "bg-sunken text-ink ring-1 ring-line"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {overview.testMode ? (
        <p className="rounded-glam bg-sunken px-4 py-3 text-sm text-warning ring-1 ring-line">
          Test mode: payments aren&rsquo;t connected on this site, so promotions are booked without a charge.
        </p>
      ) : null}

      <section className="space-y-3">
        <SectionTitle hint={overview.city ? `Prices and slots for ${overview.city}` : undefined}>On sale</SectionTitle>
        {!overview.isLive ? (
          <EmptyState icon={<Megaphone size={24} weight="light" />}>
            Promotions open up once your storefront is approved and live.
          </EmptyState>
        ) : overview.offers.length === 0 ? (
          <EmptyState icon={<Megaphone size={24} weight="light" />}>
            Nothing is on sale right now. Check back soon.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {overview.offers.map((offer) => (
              <Card key={offer.key} className="flex flex-col gap-3 p-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-700">
                    {PROMOTION_WHERE[offer.key]}
                  </p>
                  <h3 className="font-display text-lg font-bold text-ink">{offer.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{offer.description}</p>
                  <p data-numeric className="mt-2 text-xs text-ink-muted">
                    {offer.slotsFree} of {offer.slots} {offer.slots === 1 ? "slot" : "slots"} free now
                    {offer.scope === "CITY" ? ` in ${overview.city}` : " across the UK"}
                    {offer.runningUntil ? ` · yours runs until ${formatDay(offer.runningUntil)}` : ""}
                  </p>
                </div>
                {isOwner ? (
                  <BuyPromotion
                    productKey={offer.key}
                    packages={offer.packages}
                    extending={offer.runningUntil !== null}
                    disabled={!overview.isAcceptingWork}
                  />
                ) : null}
              </Card>
            ))}
          </div>
        )}
        {overview.isLive && !overview.isAcceptingWork ? (
          <p className="text-sm text-warning">
            You&rsquo;ve paused new bookings, so your profile isn&rsquo;t shown. Turn bookings back on to buy a promotion.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionTitle>Your promotions</SectionTitle>
        {overview.history.length === 0 ? (
          <EmptyState icon={<Megaphone size={24} weight="light" />}>Nothing bought yet.</EmptyState>
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {overview.history.map((promotion) => {
              const state = promotionState(promotion, now);
              return (
                <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {/* The note carries the admin's cancellation detail after
                          " — "; only the product name is the vendor's to see. */}
                      {promotion.note.split(" — ")[0] || PROMOTION_WHERE[promotion.productKey as PromotionKey] || "Promotion"}
                    </p>
                    <p data-numeric className="text-sm text-ink-muted">
                      {promotion.days} days · {formatDay(promotion.startsAt)} → {formatDay(promotion.endsAt)}
                      {promotion.city ? ` · ${promotion.city}` : ""} · {formatMoney(promotion.amountMinor)}
                    </p>
                  </div>
                  <Pill tone={state === "LIVE" || state === "SCHEDULED" ? "positive" : "neutral"}>{STATE_LABEL[state]}</Pill>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
