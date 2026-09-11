"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, EmptyState, Pill } from "@/components/ui";

export interface QueueProvider {
  id: string;
  name: string;
  email: string;
  bio: string;
  hub: string;
  status: string;
  note: string;
  serviceCount: number;
  bookingCount: number;
  createdAt: string;
}

export function ApprovalQueue({
  providers,
  emptyMessage,
}: {
  providers: QueueProvider[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/providers/${id}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: notes[id] ?? "" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not save that decision.");
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save that decision.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (providers.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}

      {providers.map((provider) => {
        const pending = provider.status === "PENDING";
        return (
          <Card key={provider.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {provider.name}
                  </h3>
                  <Pill tone={provider.status === "APPROVED" ? "positive" : provider.status === "REJECTED" ? "muted" : "neutral"}>
                    {provider.status.toLowerCase()}
                  </Pill>
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">
                  {provider.email}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{provider.hub}</p>
                {provider.bio ? (
                  <p className="mt-1 text-sm text-ink">{provider.bio}</p>
                ) : null}
                <p className="mt-1 text-xs text-ink-muted">
                  {provider.serviceCount} services listed ·{" "}
                  {provider.bookingCount} bookings
                </p>
                {!pending && provider.note ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Note: {provider.note}
                  </p>
                ) : null}
              </div>
            </div>

            {pending ? (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <label className="block">
                  <span className="text-xs text-ink-muted">
                    Note (shown to the applicant if rejected)
                  </span>
                  <input
                    value={notes[provider.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [provider.id]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => decide(provider.id, "APPROVED")}
                    disabled={busyId === provider.id}
                  >
                    {busyId === provider.id ? "Saving…" : "Approve"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => decide(provider.id, "REJECTED")}
                    disabled={busyId === provider.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 border-t border-line pt-3">
                <Button
                  variant="secondary"
                  onClick={() =>
                    decide(
                      provider.id,
                      provider.status === "APPROVED" ? "REJECTED" : "APPROVED",
                    )
                  }
                  disabled={busyId === provider.id}
                >
                  {provider.status === "APPROVED"
                    ? "Suspend this vendor"
                    : "Approve after all"}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
