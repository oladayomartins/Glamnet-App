"use client";

import { useState } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/domain/pricing";
import { ErrorNote, fieldClass } from "../../_components/bits";
import { useAdminAction } from "../../_components/use-admin-action";

type Panel = "cancel" | "refund" | "reassign" | null;

export interface Candidate {
  id: string;
  name: string;
  rating: number;
  area: string;
  sameArea: boolean;
  payoutsEnabled: boolean;
}

// Anything that is not a number counts as nothing, rather than NaN.
const toPence = (pounds: string) => Math.max(0, Math.round(Number(pounds || "0") * 100) || 0);

/**
 * Stepping in on a booking: cancel it, refund it, or move it to another
 * vendor. Each is offered only when the booking is in a state for it, and
 * says why not otherwise, so an admin isn't left guessing at a hidden button.
 */
export function BookingActions({
  bookingId,
  cancel,
  refund,
  reassign,
}: {
  bookingId: string;
  cancel: { allowed: boolean; why: string };
  refund: { allowed: true; chargeMinor: number; payoutMinor: number; canRecover: boolean } | { allowed: false; why: string };
  reassign: { allowed: boolean; why: string; current: string | null; candidates: Candidate[]; vendorPremises: boolean };
}) {
  const { run, busy, error, setError } = useAdminAction();
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [refundPounds, setRefundPounds] = useState("");
  const [recoverPounds, setRecoverPounds] = useState("0");
  const [vendor, setVendor] = useState("");

  const open = (next: Panel) => {
    setPanel(next);
    setNote("");
    setError(null);
    if (next === "refund" && refund.allowed) setRefundPounds((refund.chargeMinor / 100).toFixed(2));
    if (next === "reassign") setVendor("");
  };

  const needNote = (verb: string) => {
    if (note.trim().length < 5) {
      setError(`Write a short reason before you ${verb} — it is shown to the people involved.`);
      return true;
    }
    return false;
  };

  const option = (key: Exclude<Panel, null>, label: string, state: { allowed: boolean; why?: string }) => (
    <div className="flex flex-col">
      <Button variant={panel === key ? "primary" : "secondary"} disabled={!state.allowed} onClick={() => open(panel === key ? null : key)}>
        {label}
      </Button>
      {!state.allowed && state.why ? <span className="mt-1 max-w-[16rem] text-[11px] text-ink-muted">{state.why}</span> : null}
    </div>
  );

  const refundMinor = toPence(refundPounds);
  const recoverMinor = toPence(recoverPounds);

  return (
    <Card className="space-y-4 p-4">
      <SectionTitle>Step in</SectionTitle>
      <div className="flex flex-wrap items-start gap-3">
        {option("cancel", "Cancel booking", { allowed: cancel.allowed, why: cancel.why })}
        {option("refund", "Refund", refund.allowed ? { allowed: true } : { allowed: false, why: refund.why })}
        {option("reassign", "Move to another vendor", { allowed: reassign.allowed, why: reassign.why })}
      </div>
      <ErrorNote>{error}</ErrorNote>

      {panel === "cancel" ? (
        <div className="rise-in space-y-3 border-t border-line pt-4">
          <p className="text-sm text-ink">
            Cancels the booking for everyone. Nothing is charged, any hold on the customer&rsquo;s card is released, and both sides
            are emailed.
          </p>
          <label className="block">
            <span className="text-xs text-ink-muted">Reason (sent to the customer and vendor)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={fieldClass} />
          </label>
          <Button
            disabled={busy === "cancel"}
            onClick={async () => {
              if (needNote("cancel")) return;
              if (!window.confirm("Cancel this booking? This can't be undone.")) return;
              if (await run("cancel", `/api/bookings/${bookingId}/cancel`, "POST", { reason: note.trim() })) open(null);
            }}
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
          </Button>
        </div>
      ) : null}

      {panel === "refund" && refund.allowed ? (
        <div className="rise-in space-y-3 border-t border-line pt-4">
          <p className="text-sm text-ink">
            {formatMoney(refund.chargeMinor)} was charged; {formatMoney(refund.payoutMinor)} went to the vendor. Whatever you don&rsquo;t
            recover from the vendor, GLAMNET covers. One refund per booking — for anything contested, use a dispute.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-ink-muted">Refund to the customer (£)</span>
              <input inputMode="decimal" value={refundPounds} onChange={(e) => setRefundPounds(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-xs text-ink-muted">
                Recover from the vendor (£){refund.canRecover ? "" : " — not possible, no transfer on record"}
              </span>
              <input
                inputMode="decimal"
                value={recoverPounds}
                disabled={!refund.canRecover}
                onChange={(e) => setRecoverPounds(e.target.value)}
                className={`${fieldClass} disabled:opacity-60`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-ink-muted">Reason (included in the customer&rsquo;s email)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className={fieldClass} />
          </label>
          <p data-numeric className="text-xs text-ink-muted">
            Customer gets {formatMoney(refundMinor)} · vendor gives back {formatMoney(recoverMinor)} · GLAMNET covers{" "}
            {formatMoney(Math.max(0, refundMinor - recoverMinor))}
          </p>
          <Button
            disabled={busy === "refund" || refundMinor <= 0 || refundMinor > refund.chargeMinor || recoverMinor > Math.min(refundMinor, refund.payoutMinor)}
            onClick={async () => {
              if (needNote("refund")) return;
              if (!window.confirm(`Refund ${formatMoney(refundMinor)} to the customer's card? This goes to Stripe straight away.`)) return;
              if (
                await run("refund", `/api/admin/bookings/${bookingId}/refund`, "POST", {
                  refundMinor,
                  clawbackMinor: refund.canRecover ? recoverMinor : 0,
                  note: note.trim(),
                })
              ) {
                open(null);
              }
            }}
          >
            {busy === "refund" ? "Refunding…" : `Refund ${formatMoney(refundMinor)}`}
          </Button>
        </div>
      ) : null}

      {panel === "reassign" ? (
        <div className="rise-in space-y-3 border-t border-line pt-4">
          <p className="text-sm text-ink">
            Moves the booking from {reassign.current ?? "nobody"} to another vendor at the same time and price. Only vendors who are
            live, offer every service booked and are free then are listed; those in the same area come first.
            {reassign.vendorPremises ? " This booking is at the vendor's premises, so the customer will need the new address." : ""}
          </p>
          {reassign.candidates.length === 0 ? (
            <p className="text-sm text-warning">No other vendor is free and offers these services at that time.</p>
          ) : (
            <label className="block">
              <span className="text-xs text-ink-muted">New vendor</span>
              <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={fieldClass}>
                <option value="">Choose a vendor…</option>
                {reassign.candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.rating.toFixed(1)}★ · {candidate.area}
                    {candidate.sameArea ? " · same area" : ""}
                    {candidate.payoutsEnabled ? "" : " · payouts not set up"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs text-ink-muted">Reason (sent to both vendors and the customer)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={fieldClass} />
          </label>
          <Button
            disabled={busy === "reassign" || !vendor}
            onClick={async () => {
              if (needNote("move it")) return;
              const name = reassign.candidates.find((candidate) => candidate.id === vendor)?.name ?? "this vendor";
              if (!window.confirm(`Move this booking to ${name}? Everyone involved is told straight away.`)) return;
              if (await run("reassign", `/api/admin/bookings/${bookingId}/reassign`, "POST", { providerId: vendor, note: note.trim() })) {
                open(null);
              }
            }}
          >
            {busy === "reassign" ? "Moving…" : "Move booking"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
