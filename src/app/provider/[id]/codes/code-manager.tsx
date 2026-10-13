"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Tag } from "@phosphor-icons/react";
import { Button, Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/domain/pricing";

export interface VendorCode {
  id: string;
  code: string;
  description: string;
  label: string;
  firstBookingOnly: boolean;
  minSpendMinor: number;
  maxRedemptions: number;
  perCustomerLimit: number;
  endsAt: string | null;
  isActive: boolean;
  schedule: "LIVE" | "SCHEDULED" | "PAUSED" | "ENDED";
  uses: number;
  givenMinor: number;
}

const INPUT =
  "mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-500";

const STATUS: Record<VendorCode["schedule"], string> = {
  LIVE: "Live",
  SCHEDULED: "Starts later",
  PAUSED: "Paused",
  ENDED: "Ended",
};

const endDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/**
 * The vendor's discount codes: make one, share it, pause it. The vendor pays
 * for the discount, so the copy says so plainly where the amount is chosen.
 */
export function CodeManager({ codes, storefrontUrl }: { codes: VendorCode[]; storefrontUrl: string | null }) {
  const router = useRouter();
  const [creating, setCreating] = useState(codes.length === 0);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [amount, setAmount] = useState("10");
  const [newClientsOnly, setNewClientsOnly] = useState(false);
  const [minSpend, setMinSpend] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "That didn't work. Please try again.");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const value = Math.round(Number(amount) * 100);
    const ok = await call("/api/provider/codes", "POST", {
      code,
      discountType: kind,
      value,
      firstBookingOnly: newClientsOnly,
      minSpendMinor: minSpend ? Math.round(Number(minSpend) * 100) : 0,
      maxRedemptions: maxUses ? Math.round(Number(maxUses)) : 0,
      perCustomerLimit: 1,
      // The end of the chosen UK day.
      endsAt: endsOn ? new Date(`${endsOn}T23:59:59`).toISOString() : null,
    });
    if (ok) {
      setCreating(false);
      setCode("");
      setMinSpend("");
      setMaxUses("");
      setEndsOn("");
      setNewClientsOnly(false);
    }
  };

  const share = async (entry: VendorCode) => {
    if (!storefrontUrl) return;
    const text = `Use code ${entry.code} for ${entry.label} — book me at ${storefrontUrl}?code=${entry.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(entry.id);
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      setError("Couldn't copy. Your code is " + entry.code);
    }
  };

  const preview =
    Number(amount) > 0 ? (kind === "PERCENT" ? `${Number(amount)}% off` : `${formatMoney(Math.round(Number(amount) * 100))} off`) : "";

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}

      {creating ? (
        <Card className="space-y-4 p-4">
          <p className="text-sm font-semibold text-ink">New code</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Code</span>
              <input
                value={code}
                maxLength={24}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="e.g. AMARA10"
                className={`${INPUT} font-mono uppercase tracking-wider`}
              />
              <span className="mt-1 block text-xs text-ink-muted">3–24 letters, numbers or dashes. What clients type.</span>
            </label>
            <div>
              <span className="text-sm font-medium text-ink">Discount</span>
              <div className="mt-1 flex gap-2">
                <div className="flex shrink-0 rounded-full ring-1 ring-line" role="group" aria-label="Discount type">
                  {(["PERCENT", "FIXED"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={kind === option}
                      onClick={() => setKind(option)}
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold ${kind === option ? "bg-accent-100 text-accent-700" : "text-ink-muted"}`}
                    >
                      {option === "PERCENT" ? "%" : "£"}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={kind === "PERCENT" ? 1 : 0.5}
                  value={amount}
                  aria-label={kind === "PERCENT" ? "Percent off" : "Pounds off"}
                  onChange={(event) => setAmount(event.target.value)}
                  className={`${INPUT} mt-0`}
                />
              </div>
              <span className="mt-1 block text-xs text-ink-muted">
                Comes off your service price, so you pay for it — commission is worked out on the lower price.
              </span>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-ink">
                Minimum spend (£) <span className="text-ink-muted">(optional)</span>
              </span>
              <input type="number" min={0} step={1} value={minSpend} onChange={(event) => setMinSpend(event.target.value)} className={INPUT} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">
                Total uses <span className="text-ink-muted">(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={maxUses}
                placeholder="No limit"
                onChange={(event) => setMaxUses(event.target.value)}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">
                Ends on <span className="text-ink-muted">(optional)</span>
              </span>
              <input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={INPUT} />
            </label>
            <label className="flex items-center gap-3 self-end pb-2">
              <input
                type="checkbox"
                checked={newClientsOnly}
                onChange={(event) => setNewClientsOnly(event.target.checked)}
                className="size-5 accent-[var(--glam-gold)]"
              />
              <span className="text-sm text-ink">New clients only (their first booking with you)</span>
            </label>
          </div>
          <p className="text-xs text-ink-muted">Each client can use a code once. It only works on your storefront.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={create} disabled={busy || code.length < 3 || !(Number(amount) > 0)}>
              {busy ? "Creating…" : `Create ${code || "code"}${preview ? ` · ${preview}` : ""}`}
            </Button>
            {codes.length > 0 ? (
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Tag size={16} aria-hidden />
          New discount code
        </Button>
      )}

      {codes.length === 0 ? (
        creating ? null : (
          <EmptyState icon={<Tag size={24} weight="light" />}>No codes yet.</EmptyState>
        )
      ) : (
        <ul className="space-y-2">
          {codes.map((entry) => (
            <li key={entry.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-[17px] font-bold tracking-wider text-ink">{entry.code}</span>
                    <span className="text-sm text-ink">{entry.label}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      entry.schedule === "LIVE" ? "bg-normal-soft text-normal-ink" : "bg-sunken text-ink-muted"
                    }`}
                  >
                    {STATUS[entry.schedule]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {[
                    entry.firstBookingOnly ? "New clients only" : "Any client",
                    entry.minSpendMinor > 0 ? `spend ${formatMoney(entry.minSpendMinor)}+` : null,
                    entry.maxRedemptions > 0 ? `${entry.maxRedemptions} uses max` : null,
                    entry.endsAt ? `ends ${endDate.format(new Date(entry.endsAt))}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 text-sm text-ink" data-numeric>
                  Used {entry.uses} {entry.uses === 1 ? "time" : "times"}
                  {entry.givenMinor > 0 ? ` · ${formatMoney(entry.givenMinor)} off in total` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {storefrontUrl && entry.schedule !== "ENDED" ? (
                    <button
                      type="button"
                      onClick={() => share(entry)}
                      className="tap-44 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {copied === entry.id ? <Check size={14} weight="bold" aria-hidden /> : <Copy size={14} aria-hidden />}
                      {copied === entry.id ? "Copied" : "Copy to share"}
                    </button>
                  ) : null}
                  {entry.schedule !== "ENDED" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call(`/api/provider/codes/${entry.id}`, "PATCH", { isActive: !entry.isActive })}
                      className="tap-44 text-sm font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
                    >
                      {entry.isActive ? "Pause" : "Resume"}
                    </button>
                  ) : null}
                  {entry.uses === 0 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete ${entry.code}?`)) void call(`/api/provider/codes/${entry.id}`, "DELETE");
                      }}
                      className="tap-44 text-sm font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
