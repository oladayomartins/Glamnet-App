"use client";

import { useState } from "react";
import { Copy, Plus, Ticket } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/domain/pricing";
import { Button, Card, EmptyState } from "@/components/ui";
import { ErrorNote, fieldClass } from "../_components/bits";
import { fromLocalInput, shortDate, toLocalInput } from "../_components/date-input";
import { SchedulePill } from "../_components/schedule-pill";
import { useAdminAction } from "../_components/use-admin-action";

interface Promo {
  id: string;
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  value: number;
  maxDiscountMinor: number;
  minSpendMinor: number;
  firstBookingOnly: boolean;
  category: string;
  maxRedemptions: number;
  perCustomerLimit: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  schedule: "LIVE" | "SCHEDULED" | "PAUSED" | "ENDED";
  label: string;
  uses: number;
  givenMinor: number;
}

function conditions(promo: Promo): string {
  const parts = [
    promo.minSpendMinor > 0 ? `min spend ${formatMoney(promo.minSpendMinor)}` : null,
    promo.category ? `${promo.category} only` : null,
    promo.firstBookingOnly ? "first booking only" : null,
    promo.perCustomerLimit > 0 ? `${promo.perCustomerLimit}× per customer` : "unlimited per customer",
  ];
  return parts.filter(Boolean).join(" · ");
}

export function PromoManager({ promos, categories }: { promos: Promo[]; categories: string[] }) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ErrorNote>{error}</ErrorNote>

      {editing === "new" ? (
        <PromoForm
          categories={categories}
          busy={busy === "new"}
          onCancel={() => setEditing(null)}
          onSave={async (values) => {
            if (await run("new", "/api/admin/promos", "POST", values)) setEditing(null);
          }}
        />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} weight="bold" aria-hidden /> New promo code
        </Button>
      )}

      {promos.length === 0 && editing !== "new" ? (
        <EmptyState icon={<Ticket size={24} weight="light" />}>
          No codes yet. Try WELCOME10: 10% off a customer&rsquo;s first booking.
        </EmptyState>
      ) : null}

      {promos.map((promo) =>
        editing === promo.id ? (
          <PromoForm
            key={promo.id}
            initial={promo}
            categories={categories}
            busy={busy === promo.id}
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              if (await run(promo.id, `/api/admin/promos/${promo.id}`, "PATCH", values)) setEditing(null);
            }}
          />
        ) : (
          <Card key={promo.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(promo.code);
                      setCopied(promo.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-glam-sm border border-dashed border-accent-500 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-accent-700"
                    title="Copy code"
                  >
                    {promo.code} <Copy size={13} aria-hidden />
                  </button>
                  {copied === promo.id ? <span className="text-xs text-normal-ink">Copied</span> : null}
                  <SchedulePill schedule={promo.schedule} />
                </div>
                <p className="mt-1.5 font-semibold text-ink">{promo.label}</p>
                {promo.description ? <p className="text-sm text-ink-muted">{promo.description}</p> : null}
                <p className="mt-1 text-xs text-ink-muted">{conditions(promo)}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {shortDate(promo.startsAt)} → {promo.endsAt ? shortDate(promo.endsAt) : "no end date"}
                </p>
              </div>
              <div className="text-right">
                <p data-numeric className="font-mono text-lg font-bold text-ink">
                  {promo.uses}
                  <span className="text-sm font-normal text-ink-muted">
                    {promo.maxRedemptions > 0 ? ` / ${promo.maxRedemptions}` : ""} uses
                  </span>
                </p>
                <p data-numeric className="text-xs text-accent-700">{formatMoney(promo.givenMinor)} given</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {promo.schedule !== "ENDED" ? (
                <Button
                  variant="secondary"
                  disabled={busy === promo.id}
                  onClick={() => run(promo.id, `/api/admin/promos/${promo.id}`, "PATCH", { isActive: !promo.isActive })}
                >
                  {promo.isActive ? "Pause" : "Resume"}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setEditing(promo.id)}>
                Edit
              </Button>
              {promo.uses === 0 ? (
                <Button
                  variant="ghost"
                  disabled={busy === promo.id}
                  onClick={() => {
                    if (window.confirm(`Delete ${promo.code}?`)) void run(promo.id, `/api/admin/promos/${promo.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

const poundsInput = (minor: number) => (minor ? (minor / 100).toFixed(2) : "");
const toMinor = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));

function PromoForm({
  initial,
  categories,
  busy,
  onSave,
  onCancel,
}: {
  initial?: Promo;
  categories: string[];
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(initial?.discountType ?? "PERCENT");
  const [amount, setAmount] = useState(
    initial ? (initial.discountType === "PERCENT" ? String(initial.value / 100) : (initial.value / 100).toFixed(2)) : "10",
  );
  const [cap, setCap] = useState(poundsInput(initial?.maxDiscountMinor ?? 0));
  const [minSpend, setMinSpend] = useState(poundsInput(initial?.minSpendMinor ?? 0));
  const [category, setCategory] = useState(initial?.category ?? "");
  const [firstBookingOnly, setFirstBookingOnly] = useState(initial?.firstBookingOnly ?? false);
  const [maxRedemptions, setMaxRedemptions] = useState(String(initial?.maxRedemptions ?? 0));
  const [perCustomerLimit, setPerCustomerLimit] = useState(String(initial?.perCustomerLimit ?? 1));
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const value = discountType === "PERCENT" ? Math.round((Number(amount) || 0) * 100) : toMinor(amount);
  const valid = code.trim().length >= 3 && value > 0 && (discountType === "FIXED" || value <= 10_000);

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            className={`${fieldClass} font-mono uppercase tracking-wider`}
            placeholder="WELCOME10"
            maxLength={24}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Note (only admins see this)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} placeholder="Instagram launch" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-ink-muted">Discount type</span>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")} className={fieldClass}>
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">{discountType === "PERCENT" ? "Percent off" : "Amount off (£)"}</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
        </label>
        {discountType === "PERCENT" ? (
          <label className="block">
            <span className="text-xs text-ink-muted">Maximum discount (£, optional)</span>
            <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className={fieldClass} placeholder="No cap" />
          </label>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Minimum spend on services (£, optional)</span>
          <input inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} className={fieldClass} placeholder="None" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Only for a category (optional)</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            <option value="">Any category</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Total uses allowed (0 = unlimited)</span>
          <input type="number" min={0} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Uses per customer (0 = unlimited)</span>
          <input type="number" min={0} value={perCustomerLimit} onChange={(e) => setPerCustomerLimit(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Ends (optional)</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={firstBookingOnly} onChange={(e) => setFirstBookingOnly(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          First GLAMNET booking only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Live (within the dates above)
        </label>
      </div>
      <p className="text-xs text-ink-muted">
        On bookings through the directory GLAMNET keeps 30%, so there is plenty of room for a discount. On bookings through a
        vendor&rsquo;s own link GLAMNET keeps only the trust fee and 2% card fee, so the discount there is small.
      </p>
      <div className="flex gap-2">
        <Button
          disabled={busy || !valid}
          onClick={() =>
            onSave({
              code,
              description,
              discountType,
              value,
              maxDiscountMinor: discountType === "PERCENT" ? toMinor(cap) : 0,
              minSpendMinor: toMinor(minSpend),
              category,
              firstBookingOnly,
              maxRedemptions: Math.max(0, Number(maxRedemptions) || 0),
              perCustomerLimit: Math.max(0, Number(perCustomerLimit) || 0),
              startsAt: fromLocalInput(startsAt),
              endsAt: fromLocalInput(endsAt),
              isActive,
            })
          }
        >
          {busy ? "Saving…" : initial ? "Save code" : "Create code"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
