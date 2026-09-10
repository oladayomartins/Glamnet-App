"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

/**
 * Emergency pricing configuration (spec §5): threshold, surcharge type, amount,
 * effective date and active flag — all changeable without a release.
 *
 * Saving inserts a new config row rather than editing the current one, so the
 * terms that priced a historic booking stay on record.
 */
export function EmergencyConfigForm({
  thresholdMinutes: initialThreshold,
  surchargeType: initialType,
  surchargeValue: initialValue,
}: {
  thresholdMinutes: number;
  surchargeType: string;
  surchargeValue: number;
}) {
  const router = useRouter();

  const [thresholdHours, setThresholdHours] = useState(
    String(initialThreshold / 60),
  );
  const [surchargeType, setSurchargeType] = useState(initialType);
  // Percentages are entered as percent and stored as basis points; fixed
  // amounts are entered as pounds and stored as pence.
  const [amount, setAmount] = useState(String(initialValue / 100));
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string } | { kind: "saved" }
  >({ kind: "idle" });

  const save = async () => {
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/admin/emergency-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thresholdMinutes: Math.round(Number(thresholdHours) * 60),
          surchargeType,
          surchargeValue: Math.round(Number(amount) * 100),
          ...(effectiveFrom
            ? { effectiveFrom: new Date(effectiveFrom).toISOString() }
            : {}),
          isActive,
          note,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not save the configuration.");
      }
      setStatus({ kind: "saved" });
      setNote("");
      router.refresh();
    } catch (cause) {
      setStatus({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Could not save.",
      });
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-ink">
            Emergency threshold (hours)
          </span>
          <input
            type="number"
            min={0.25}
            step={0.25}
            value={thresholdHours}
            onChange={(event) => setThresholdHours(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Bookings placed within this window are tagged EMERGENCY.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Surcharge type</span>
          <select
            value={surchargeType}
            onChange={(event) => setSurchargeType(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="PERCENTAGE">Percentage of services</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">
            {surchargeType === "FIXED" ? "Amount (£)" : "Rate (%)"}
          </span>
          <input
            type="number"
            min={0}
            step={surchargeType === "FIXED" ? 0.5 : 0.25}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">
            Effective from{" "}
            <span className="text-ink-muted">(optional)</span>
          </span>
          <input
            type="datetime-local"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Leave blank to apply immediately.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this rate changed"
            className="mt-1 min-h-11 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="size-5 accent-[var(--glam-rose-700)]"
          />
          <span className="text-sm font-medium text-ink">Active</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Publishing…" : "Publish configuration"}
        </Button>
        {status.kind === "saved" ? (
          <span className="text-sm text-normal-ink" role="status">
            Saved — new bookings price against these terms.
          </span>
        ) : null}
        {status.kind === "error" ? (
          <span className="text-sm text-warning" role="alert">
            {status.message}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
