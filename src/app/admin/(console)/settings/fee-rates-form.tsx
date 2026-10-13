"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { formatMoney } from "@/lib/domain/pricing";
import { decideCommission, settle, trustFeeFor } from "@/lib/domain/settlement";
import { feeRatesProblem, type FeeRates } from "@/lib/domain/fee-rates";

const INPUT =
  "mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400";

type Field = {
  key: keyof FeeRates;
  label: string;
  hint: string;
  unit: "%" | "£";
};

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Commission (taken from the vendor's service price)",
    fields: [
      {
        key: "discoveryCommissionBps",
        label: "New client from the marketplace",
        hint: "A client's first booking with a vendor found through the directory or an emergency request.",
        unit: "%",
      },
      {
        key: "repeatCommissionBps",
        label: "Vendor's own link and repeat clients",
        hint: "Bookings through the vendor's /pro link, and every booking after a client's first.",
        unit: "%",
      },
    ],
  },
  {
    title: "Service fees",
    fields: [
      {
        key: "cardFeeBps",
        label: "Card processing fee",
        hint: "Taken from the vendor's payout on own-link and repeat bookings. On a new marketplace client GLAMNET covers it.",
        unit: "%",
      },
      {
        key: "trustFeeMinor",
        label: "Client booking fee — marketplace",
        hint: "Added to the client's bill on marketplace and emergency bookings. Kept by GLAMNET.",
        unit: "£",
      },
      {
        key: "directTrustFeeMinor",
        label: "Client booking fee — vendor's own link",
        hint: "Added to the client's bill when they book through a vendor's own link.",
        unit: "£",
      },
      {
        key: "travelFeeMinor",
        label: "Home-visit travel fee",
        hint: "Added when the vendor travels to the client. Paid to the vendor in full. Applies to every area.",
        unit: "£",
      },
    ],
  },
  {
    title: "Cancellation fees (share of the service price)",
    fields: [
      {
        key: "lateCancellationFeeBps",
        label: "Late cancellation",
        hint: "Client cancels inside the free-cancellation window.",
        unit: "%",
      },
      {
        key: "noShowFeeBps",
        label: "Missed appointment",
        hint: "Client doesn't turn up. The travel fee is charged on top for a home visit.",
        unit: "%",
      },
    ],
  },
];

const toInput = (key: keyof FeeRates, value: number) => (key.endsWith("Bps") ? String(value / 100) : (value / 100).toFixed(2));
const fromInput = (raw: string) => Math.round(Number(raw) * 100);

/**
 * Every commission and fee rate, editable by an admin. Publishing adds a new
 * set of rates for bookings made from then on; bookings already made keep
 * theirs. A worked example under the form shows what the change does to a
 * £100 booking before anything is published.
 */
export function FeeRatesForm({ current }: { current: FeeRates }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof FeeRates, string>>(
    () => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, toInput(key as keyof FeeRates, value)])) as Record<keyof FeeRates, string>,
  );
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  const rates = useMemo(
    () => Object.fromEntries(Object.entries(values).map(([key, raw]) => [key, fromInput(raw)])) as unknown as FeeRates,
    [values],
  );
  const problem = Object.values(values).some((raw) => raw.trim() === "" || !Number.isFinite(Number(raw)))
    ? "Fill in every rate."
    : feeRatesProblem(rates);
  const changed = (Object.keys(current) as (keyof FeeRates)[]).some((key) => rates[key] !== current[key]);

  // A £100 service through each route, priced with the rates as typed.
  const example = useMemo(() => {
    if (problem) return null;
    const run = (source: "DIRECT_LINK" | "MARKETPLACE") => {
      const trust = trustFeeFor(source, rates);
      const result = settle({
        totalMinor: 10_000 + trust,
        commissionableMinor: 10_000,
        trustFeeMinor: trust,
        tipMinor: 0,
        commission: decideCommission({ source, hasPriorBooking: false }, rates),
      });
      return { clientPays: 10_000 + trust, vendorGets: result.providerPayoutMinor, glamnetKeeps: result.platformRetainedMinor };
    };
    return { marketplace: run("MARKETPLACE"), direct: run("DIRECT_LINK") };
  }, [problem, rates]);

  const save = async () => {
    if (problem) return;
    if (!window.confirm("Publish these rates? They apply to bookings made from now on. Bookings already made keep their rates.")) return;
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/admin/fee-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...rates, note }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.issues?.[0]?.message ?? payload.error?.message ?? "Could not publish the rates.");
      }
      setStatus({ kind: "saved" });
      setNote("");
      router.refresh();
    } catch (cause) {
      setStatus({ kind: "error", message: cause instanceof Error ? cause.message : "Could not publish the rates." });
    }
  };

  return (
    <Card className="space-y-6 p-4">
      {GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend className="text-sm font-semibold text-ink">{group.title}</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              const edited = rates[field.key] !== current[field.key];
              return (
                <label key={field.key} className="block">
                  <span className="text-sm font-medium text-ink">
                    {field.label} ({field.unit})
                    {edited ? <span className="ml-2 text-xs font-semibold text-accent-700">changed</span> : null}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={field.unit === "%" ? 0.5 : 0.05}
                    value={values[field.key]}
                    onChange={(event) => {
                      setStatus({ kind: "idle" });
                      setValues((current) => ({ ...current, [field.key]: event.target.value }));
                    }}
                    className={INPUT}
                  />
                  <span className="mt-1 block text-xs text-ink-muted">{field.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {example ? (
        <div className="rounded-glam-sm bg-sunken p-3 text-sm">
          <p className="font-semibold text-ink">On a £100 service, with these rates</p>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["New client from the marketplace", example.marketplace],
                ["Vendor's own link / repeat client", example.direct],
              ] as const
            ).map(([label, row]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
                <dd className="mt-1 space-y-0.5 tabular-nums text-ink">
                  <span className="block">Client pays {formatMoney(row.clientPays)}</span>
                  <span className="block">Vendor gets {formatMoney(row.vendorGets)}</span>
                  <span className="block">GLAMNET keeps {formatMoney(row.glamnetKeeps)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <label className="block max-w-lg">
        <span className="text-sm font-medium text-ink">Note</span>
        <input
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why the rates changed (kept in the audit log)"
          className={INPUT}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={status.kind === "saving" || Boolean(problem) || !changed}>
          {status.kind === "saving" ? "Publishing…" : "Publish rates"}
        </Button>
        {problem ? (
          <span className="text-sm text-warning" role="alert">
            {problem}
          </span>
        ) : status.kind === "saved" ? (
          <span className="text-sm text-normal-ink" role="status">
            Published — new bookings use these rates.
          </span>
        ) : status.kind === "error" ? (
          <span className="text-sm text-warning" role="alert">
            {status.message}
          </span>
        ) : !changed ? (
          <span className="text-sm text-ink-muted">Change a rate to publish.</span>
        ) : null}
      </div>
    </Card>
  );
}
