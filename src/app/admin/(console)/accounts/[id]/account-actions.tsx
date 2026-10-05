"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { ErrorNote, fieldClass } from "../../_components/bits";
import { useAdminAction } from "../../_components/use-admin-action";

/**
 * Suspend, reinstate and feature, from the account page.
 *
 * Suspension asks for its reason in the page rather than a browser prompt:
 * the person sees it, so it deserves a proper field and a second look.
 */
export function AccountActions({
  appUserId,
  email,
  isAdmin,
  suspended,
  vendor,
}: {
  appUserId: string | null;
  email: string;
  isAdmin: boolean;
  suspended: boolean;
  vendor: { id: string; live: boolean; featured: boolean } | null;
}) {
  const { run, busy, error, setError } = useAdminAction();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3">
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        {vendor?.live ? (
          <Button
            variant="secondary"
            disabled={busy === "feature"}
            onClick={() => run("feature", `/api/admin/providers/${vendor.id}`, "PATCH", { isFeatured: !vendor.featured })}
          >
            {vendor.featured ? "Stop featuring" : "Feature on the home page"}
          </Button>
        ) : null}
        {!appUserId ? (
          <span className="self-center text-xs text-ink-muted">No login yet, so nothing to suspend.</span>
        ) : isAdmin ? (
          <span className="self-center text-xs text-ink-muted">Admin access is managed in ADMIN_EMAILS.</span>
        ) : suspended ? (
          <Button
            variant="secondary"
            disabled={busy === "account"}
            onClick={() => {
              if (window.confirm(`Reinstate ${email}? They can sign in again straight away.`)) {
                void run("account", `/api/admin/accounts/${appUserId}`, "PATCH", { suspended: false });
              }
            }}
          >
            {busy === "account" ? "Saving…" : "Reinstate account"}
          </Button>
        ) : (
          <Button variant="secondary" className="text-warning" onClick={() => setSuspending(true)} disabled={suspending}>
            Suspend account
          </Button>
        )}
      </div>

      {suspending && appUserId ? (
        <Card className="rise-in space-y-3 border-warning/50 p-4">
          <p className="text-sm text-ink">
            Suspending signs {email} out of everything
            {vendor?.live ? " and takes their storefront off the marketplace" : ""}. Bookings already made are not cancelled.
          </p>
          <label className="block">
            <span className="text-xs text-ink-muted">Reason (they see this)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className={fieldClass} />
          </label>
          <div className="flex gap-2">
            <Button
              disabled={busy === "account"}
              onClick={async () => {
                if (reason.trim().length < 5) {
                  setError("Give a reason of at least a few words — the person sees it.");
                  return;
                }
                if (await run("account", `/api/admin/accounts/${appUserId}`, "PATCH", { suspended: true, reason: reason.trim() })) {
                  setSuspending(false);
                  setReason("");
                }
              }}
            >
              {busy === "account" ? "Suspending…" : "Suspend"}
            </Button>
            <Button variant="ghost" onClick={() => setSuspending(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
