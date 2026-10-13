"use client";

import { useState } from "react";
import Link from "next/link";
import { Megaphone } from "@phosphor-icons/react";
import { Button, Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { ErrorNote, LiveSwitch, fieldClass } from "../_components/bits";
import { shortDate } from "../_components/date-input";
import { useAdminAction } from "../_components/use-admin-action";

interface Product {
  key: string;
  name: string;
  description: string;
  where: string;
  scope: "CITY" | "NATIONAL";
  slots: number;
  price7Minor: number;
  price14Minor: number;
  price30Minor: number;
  isActive: boolean;
}

interface Purchase {
  id: string;
  vendor: string;
  vendorSlug: string | null;
  product: string;
  city: string;
  days: number;
  amountMinor: number;
  startsAt: string;
  endsAt: string;
  state: "PENDING" | "SCHEDULED" | "LIVE" | "ENDED" | "EXPIRED" | "CANCELLED" | "REFUNDED";
  note: string;
  refundable: boolean;
}

const STATE_LABEL: Record<Purchase["state"], string> = {
  PENDING: "Awaiting payment",
  SCHEDULED: "Booked",
  LIVE: "Live",
  ENDED: "Ended",
  EXPIRED: "Not paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const PRICE_FIELDS = [
  ["price7Minor", "7 days"],
  ["price14Minor", "14 days"],
  ["price30Minor", "30 days"],
] as const;

export function PromotionManager({ products, purchases }: { products: Product[]; purchases: Purchase[] }) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <ErrorNote>{error}</ErrorNote>

      <section>
        <SectionTitle hint="Off until you switch it on. A price of £0 means that length isn't sold.">What vendors can buy</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {products.map((product) =>
            editing === product.key ? (
              <ProductForm
                key={product.key}
                product={product}
                busy={busy === product.key}
                onCancel={() => setEditing(null)}
                onSave={async (values) => {
                  if (await run(product.key, `/api/admin/promotion-products/${product.key}`, "PATCH", values)) setEditing(null);
                }}
              />
            ) : (
              <Card key={product.key} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-700">{product.where}</p>
                    <p className="font-semibold text-ink">{product.name}</p>
                  </div>
                  <LiveSwitch
                    on={product.isActive}
                    busy={busy === product.key}
                    label={`${product.name} on sale`}
                    onToggle={() => run(product.key, `/api/admin/promotion-products/${product.key}`, "PATCH", { isActive: !product.isActive })}
                  />
                </div>
                <p className="text-sm text-ink-muted">{product.description}</p>
                <p data-numeric className="text-sm text-ink">
                  {PRICE_FIELDS.map(([field, label]) => `${label} ${product[field] ? formatMoney(product[field]) : "—"}`).join(" · ")}
                </p>
                <p className="text-xs text-ink-muted">
                  {product.slots} {product.slots === 1 ? "slot" : "slots"} {product.scope === "CITY" ? "per city" : "across the UK"}
                </p>
                <div className="mt-auto pt-1">
                  <Button variant="secondary" onClick={() => setEditing(product.key)}>
                    Edit prices
                  </Button>
                </div>
              </Card>
            ),
          )}
        </div>
      </section>

      <section>
        <SectionTitle hint="Newest first">Purchases</SectionTitle>
        {purchases.length === 0 ? (
          <EmptyState icon={<Megaphone size={22} weight="light" />}>No vendor has bought a promotion yet.</EmptyState>
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {purchases.map((purchase) => {
              const cancellable = purchase.state === "LIVE" || purchase.state === "SCHEDULED";
              return (
                <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {purchase.vendorSlug ? (
                        <Link href={`/pro/${purchase.vendorSlug}`} className="hover:text-brand-700">
                          {purchase.vendor}
                        </Link>
                      ) : (
                        purchase.vendor
                      )}{" "}
                      <span className="font-normal text-ink-muted">· {purchase.product}</span>
                    </p>
                    <p data-numeric className="text-sm text-ink-muted">
                      {purchase.city ? `${purchase.city} · ` : ""}
                      {purchase.days} days · {shortDate(purchase.startsAt)} → {shortDate(purchase.endsAt)} ·{" "}
                      {purchase.amountMinor ? formatMoney(purchase.amountMinor) : "free"}
                    </p>
                    {purchase.note ? <p className="text-xs text-ink-muted">{purchase.note}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={cancellable ? "positive" : "neutral"}>{STATE_LABEL[purchase.state]}</Pill>
                    {cancellable ? (
                      <>
                        {purchase.refundable ? (
                          <Button
                            variant="secondary"
                            disabled={busy === purchase.id}
                            onClick={() => {
                              if (window.confirm(`Take down ${purchase.vendor}'s promotion and refund ${formatMoney(purchase.amountMinor)} to their card?`)) {
                                void run(purchase.id, `/api/admin/promotions/${purchase.id}/cancel`, "POST", { refund: true });
                              }
                            }}
                          >
                            Refund
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          disabled={busy === purchase.id}
                          onClick={() => {
                            if (window.confirm(`Take down ${purchase.vendor}'s promotion now, without a refund?`)) {
                              void run(purchase.id, `/api/admin/promotions/${purchase.id}/cancel`, "POST", { refund: false });
                            }
                          }}
                        >
                          Take down
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

function ProductForm({
  product,
  busy,
  onSave,
  onCancel,
}: {
  product: Product;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [slots, setSlots] = useState(String(product.slots));
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(PRICE_FIELDS.map(([field]) => [field, product[field] ? (product[field] / 100).toFixed(2) : ""])),
  );

  const toMinor = (value: string) => Math.round((Number(value) || 0) * 100);

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4">
      <label className="block">
        <span className="text-xs text-ink-muted">Name vendors see</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} maxLength={60} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-muted">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} rows={3} maxLength={300} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {PRICE_FIELDS.map(([field, label]) => (
          <label key={field} className="block">
            <span className="text-xs text-ink-muted">{label} (£)</span>
            <input
              inputMode="decimal"
              value={prices[field]}
              placeholder="Not sold"
              onChange={(e) => setPrices({ ...prices, [field]: e.target.value })}
              className={fieldClass}
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="text-xs text-ink-muted">Slots {product.scope === "CITY" ? "per city" : "across the UK"}</span>
        <input inputMode="numeric" value={slots} onChange={(e) => setSlots(e.target.value)} className={fieldClass} />
      </label>
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            onSave({
              name,
              description,
              slots: Math.max(0, Math.round(Number(slots) || 0)),
              ...Object.fromEntries(PRICE_FIELDS.map(([field]) => [field, toMinor(prices[field])])),
            })
          }
        >
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
