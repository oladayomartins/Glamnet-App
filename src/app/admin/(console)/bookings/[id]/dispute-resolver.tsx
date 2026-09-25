"use client";

import { useMemo, useState } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { planDisputeRuling, type DisputeStage } from "@/lib/domain/payment-rules";
import { ErrorNote, fieldClass } from "../../_components/bits";
import { useAdminAction } from "../../_components/use-admin-action";

const STAGE_LABEL: Record<DisputeStage, string> = {
  HELD: "Still held on the customer's card — nothing captured or paid out yet.",
  RELEASED: "Already captured and paid out to the vendor.",
  NONE: "No card payment on this booking.",
};

const toPence = (pounds: string) => Math.round(Number(pounds || "0") * 100);
const toPounds = (minor: number) => (minor / 100).toFixed(2);

/**
 * Rule on a service dispute: how much the customer gets back, and how much
 * of that is recovered from the vendor. The preview uses the same rules the
 * server applies, so what is shown here is what happens.
 */
export function DisputeResolver({
  bookingId,
  reason,
  stage,
  chargeMinor,
  payoutMinor,
}: {
  bookingId: string;
  reason: string;
  stage: DisputeStage;
  chargeMinor: number;
  payoutMinor: number;
}) {
  const { run, busy, error } = useAdminAction();
  const [refund, setRefund] = useState("0.00");
  const [clawback, setClawback] = useState("0.00");
  const [note, setNote] = useState("");

  const preview = useMemo(() => {
    try {
      return {
        plan: planDisputeRuling({
          stage,
          chargeMinor,
          payoutMinor,
          ruling: { refundMinor: toPence(refund), clawbackMinor: toPence(clawback) },
        }),
        problem: null,
      };
    } catch (cause) {
      return { plan: null, problem: cause instanceof Error ? cause.message : "Check the amounts." };
    }
  }, [stage, chargeMinor, payoutMinor, refund, clawback]);

  const preset = (share: number) => {
    setRefund(toPounds(Math.round(chargeMinor * share)));
    setClawback(toPounds(Math.round(payoutMinor * share)));
  };

  const submit = () => {
    if (!preview.plan) return;
    const { plan } = preview;
    const confirmText =
      `Resolve this dispute?\n\n` +
      `Customer gets back: ${formatMoney(plan.refundMinor)}\n` +
      `Vendor receives: ${formatMoney(plan.vendorPayMinor)}\n` +
      (plan.platformCostMinor > 0 ? `GLAMNET absorbs: ${formatMoney(plan.platformCostMinor)}\n` : "") +
      `\nThis moves money in Stripe and can't be undone here.`;
    if (!window.confirm(confirmText)) return;
    void run("resolve", `/api/admin/bookings/${bookingId}/resolve`, "POST", {
      refundMinor: plan.refundMinor,
      clawbackMinor: plan.clawbackMinor,
      note,
    });
  };

  return (
    <Card className="space-y-4 border-warning/60 p-4">
      <div>
        <SectionTitle>Resolve this dispute</SectionTitle>
        <p className="text-sm text-ink">
          <span className="text-ink-muted">Customer says: </span>&ldquo;{reason || "No reason given"}&rdquo;
        </p>
        <p className="mt-1 text-xs text-ink-muted">{STAGE_LABEL[stage]}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-glam-sm bg-sunken p-3">
          <dt className="text-xs text-ink-muted">Customer paid</dt>
          <dd className="font-mono font-semibold text-ink">{formatMoney(chargeMinor)}</dd>
        </div>
        <div className="rounded-glam-sm bg-sunken p-3">
          <dt className="text-xs text-ink-muted">Vendor payout</dt>
          <dd className="font-mono font-semibold text-ink">{formatMoney(payoutMinor)}</dd>
        </div>
      </dl>

      {stage !== "NONE" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => preset(0)}>Side with vendor</Button>
            <Button variant="secondary" onClick={() => preset(0.5)}>Half refund</Button>
            <Button variant="secondary" onClick={() => preset(1)}>Full refund</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-ink-muted">Refund to customer (£)</span>
              <input inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} className={`${fieldClass} font-mono`} />
            </label>
            <label className="block">
              <span className="text-xs text-ink-muted">Recover from vendor (£)</span>
              <input inputMode="decimal" value={clawback} onChange={(e) => setClawback(e.target.value)} className={`${fieldClass} font-mono`} />
            </label>
          </div>
        </>
      ) : null}

      {preview.plan ? (
        <dl className="space-y-1 rounded-glam-sm border border-line p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Customer gets back</dt>
            <dd className="font-mono text-ink">{formatMoney(preview.plan.refundMinor)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Vendor receives</dt>
            <dd className="font-mono text-ink">{formatMoney(preview.plan.vendorPayMinor)}</dd>
          </div>
          {preview.plan.platformCostMinor > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">GLAMNET absorbs</dt>
              <dd className="font-mono text-warning">{formatMoney(preview.plan.platformCostMinor)}</dd>
            </div>
          ) : null}
          <p className="pt-1 text-xs text-ink-muted">
            {preview.plan.stage === "HELD"
              ? preview.plan.captureMinor === 0
                ? "The whole hold is released; nothing is taken from the card."
                : `${formatMoney(preview.plan.captureMinor)} is captured from the hold; the rest is released.`
              : preview.plan.stage === "RELEASED"
                ? "The refund goes back to the customer's card, and the recovery is reversed from the vendor's transfer."
                : "No money moves; the dispute is closed with your note."}
          </p>
        </dl>
      ) : (
        <p className="text-sm text-warning">{preview.problem}</p>
      )}

      <label className="block">
        <span className="text-xs text-ink-muted">Note to both sides (required)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1_000}
          className={fieldClass}
          placeholder="e.g. The photos show the braids were finished as booked, but the appointment ran two hours late."
        />
      </label>

      <ErrorNote>{error}</ErrorNote>
      <Button onClick={submit} disabled={!preview.plan || note.trim().length < 5 || busy === "resolve"} className="w-full">
        {busy === "resolve" ? "Resolving…" : "Resolve dispute"}
      </Button>
    </Card>
  );
}
