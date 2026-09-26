"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, Star } from "@phosphor-icons/react";
import { Button, Card, EmptyState, Pill } from "@/components/ui";
import { ErrorNote, fieldClass } from "../_components/bits";
import { useAdminAction } from "../_components/use-admin-action";

export interface QueueProvider {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string;
  hub: string;
  status: string;
  note: string;
  serviceCount: number;
  bookingCount: number;
  createdAt: string;
  slug: string;
  submitted: boolean;
  payoutsEnabled: boolean;
  isFeatured: boolean;
  documents: { id: string; kind: string; fileName: string; status: string; url: string }[];
}

type Decision = "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING";

const TONE: Record<string, "positive" | "muted" | "neutral"> = {
  APPROVED: "positive",
  REJECTED: "muted",
  SUSPENDED: "muted",
};

export function ApprovalQueue({ providers, emptyMessage }: { providers: QueueProvider[]; emptyMessage: string }) {
  const { run, busy, error } = useAdminAction();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = (id: string, decision: Decision) =>
    run(`${id}:${decision}`, `/api/admin/providers/${id}/approval`, "POST", { decision, note: notes[id] ?? "" });
  const feature = (id: string, isFeatured: boolean) =>
    run(`${id}:feature`, `/api/admin/providers/${id}`, "PATCH", { isFeatured });

  if (providers.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;

  return (
    <div className="space-y-3">
      <ErrorNote>{error}</ErrorNote>

      {providers.map((provider) => {
        const working = busy?.startsWith(provider.id) ?? false;
        const noteField = (label: string) => (
          <label className="block">
            <span className="text-xs text-ink-muted">{label}</span>
            <input
              value={notes[provider.id] ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [provider.id]: event.target.value }))}
              className={fieldClass}
            />
          </label>
        );

        return (
          <Card key={provider.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              {provider.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail
                <img
                  src={`${provider.avatarUrl}?tr=w-96,h-96,fo-auto`}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-accent-500/60"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunken font-display font-bold text-ink-muted">
                  {provider.name.charAt(0)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-ink">{provider.name}</h3>
                  <Pill tone={TONE[provider.status] ?? "neutral"}>{provider.status.toLowerCase()}</Pill>
                  {provider.isFeatured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                      <Star size={11} weight="fill" aria-hidden /> Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">{provider.email}</p>
                <p className="mt-1 text-sm text-ink-muted">{provider.hub}</p>
                {provider.bio ? <p className="mt-1 text-sm text-ink">{provider.bio}</p> : null}
                <p className="mt-1 text-xs text-ink-muted">
                  {provider.serviceCount} services · {provider.bookingCount} bookings ·{" "}
                  {provider.submitted ? "wizard submitted" : "wizard not finished"} ·{" "}
                  {provider.payoutsEnabled ? "payouts linked" : "no payout account"}
                </p>
                {provider.slug ? (
                  <Link
                    href={`/pro/${provider.slug}`}
                    target="_blank"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline"
                  >
                    /pro/{provider.slug} <ArrowSquareOut size={12} aria-hidden />
                  </Link>
                ) : null}

                <div className="mt-2">
                  <p className="text-xs font-medium text-ink">Compliance documents</p>
                  {provider.documents.length === 0 ? (
                    <p className="text-xs text-warning">None uploaded — cannot be approved until one is.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {provider.documents.map((document) => (
                        <li key={document.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <a href={document.url} target="_blank" rel="noreferrer" className="font-medium text-accent-700 underline">
                            {document.fileName || document.kind}
                          </a>
                          <span className="text-ink-muted">{document.kind.toLowerCase()}</span>
                          <Pill tone={document.status === "APPROVED" ? "positive" : "neutral"}>{document.status.toLowerCase()}</Pill>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {provider.status !== "PENDING" && provider.note ? (
                  <p className="mt-1 text-xs text-ink-muted">Note: {provider.note}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {provider.status === "PENDING" ? (
                <>
                  {noteField("Note (shown to the applicant if rejected)")}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide(provider.id, "APPROVED")} disabled={working}>
                      {busy === `${provider.id}:APPROVED` ? "Approving…" : "Approve"}
                    </Button>
                    <Button variant="secondary" onClick={() => decide(provider.id, "REJECTED")} disabled={working}>
                      Reject
                    </Button>
                  </div>
                </>
              ) : provider.status === "APPROVED" ? (
                <>
                  {noteField("Reason (shown to the vendor if suspended)")}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => feature(provider.id, !provider.isFeatured)} disabled={working}>
                      <Star size={14} weight={provider.isFeatured ? "fill" : "regular"} aria-hidden />
                      {provider.isFeatured ? "Stop featuring" : "Feature"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (window.confirm(`Suspend ${provider.name}? Their storefront goes offline immediately.`)) {
                          void decide(provider.id, "SUSPENDED");
                        }
                      }}
                      disabled={working}
                      className="text-warning"
                    >
                      Suspend
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => decide(provider.id, "APPROVED")} disabled={working}>
                    {provider.status === "SUSPENDED" ? "Reinstate" : "Approve after all"}
                  </Button>
                  {provider.status === "REJECTED" ? (
                    <Button variant="ghost" onClick={() => decide(provider.id, "PENDING")} disabled={working}>
                      Send back to review
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
