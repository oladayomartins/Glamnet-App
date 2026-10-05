"use client";

import { useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Button, Pill } from "@/components/ui";
import { ErrorNote, fieldClass } from "./bits";
import { useAdminAction } from "./use-admin-action";

export interface ReviewDocument {
  id: string;
  kind: string;
  fileName: string;
  url: string;
  status: string;
  reviewNote: string;
  uploadedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/** "2026-10-05" for a date input, from an ISO timestamp. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function expiryState(expiresAt: string | null): { label: string; tone: "muted" | "neutral" } | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `expired ${DAY.format(new Date(expiresAt))}`, tone: "muted" };
  if (days <= 30) return { label: `expires in ${days} day${days === 1 ? "" : "s"}`, tone: "muted" };
  return { label: `valid to ${DAY.format(new Date(expiresAt))}`, tone: "neutral" };
}

/**
 * A vendor's documents, each reviewable on its own: open it, approve or
 * reject it with a note, and record when it expires.
 */
export function DocumentReview({ providerId, documents }: { providerId: string; documents: ReviewDocument[] }) {
  const { run, busy, error } = useAdminAction();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState("");

  if (documents.length === 0) {
    return <p className="text-sm text-ink-muted">No documents uploaded yet.</p>;
  }

  const review = async (doc: ReviewDocument, status: "APPROVED" | "REJECTED" | "PENDING") => {
    const ok = await run(doc.id, `/api/admin/providers/${providerId}/documents/${doc.id}`, "PATCH", {
      status,
      note: status === "APPROVED" && !note.trim() ? "" : note.trim(),
      expiresAt: expiry ? new Date(`${expiry}T23:59:59Z`).toISOString() : null,
    });
    if (ok) setOpen(null);
  };

  return (
    <div className="space-y-2">
      <ErrorNote>{error}</ErrorNote>
      <ul className="divide-y divide-line rounded-glam border border-line bg-surface">
        {documents.map((doc) => {
          const expires = expiryState(doc.expiresAt);
          return (
            <li key={doc.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-ink hover:text-accent-700"
                >
                  <span className="truncate">{doc.fileName || doc.kind}</span>
                  <ArrowSquareOut size={13} aria-hidden />
                </a>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{doc.kind.replaceAll("_", " ")}</span>
                <Pill tone={doc.status === "APPROVED" ? "positive" : doc.status === "REJECTED" ? "muted" : "neutral"}>
                  {doc.status.toLowerCase()}
                </Pill>
                {expires ? <Pill tone={expires.tone}>{expires.label}</Pill> : null}
                <span className="ml-auto text-xs text-ink-muted">Uploaded {DAY.format(new Date(doc.uploadedAt))}</span>
                {open !== doc.id ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOpen(doc.id);
                      setNote(doc.reviewNote);
                      setExpiry(toDateInput(doc.expiresAt));
                    }}
                  >
                    Review
                  </Button>
                ) : null}
              </div>
              {doc.reviewNote && open !== doc.id ? <p className="mt-1 text-xs text-ink-muted">Note: {doc.reviewNote}</p> : null}

              {open === doc.id ? (
                <div className="rise-in mt-2 grid gap-2 sm:grid-cols-[1fr_11rem]">
                  <label className="block">
                    <span className="text-xs text-ink-muted">Note (emailed to the vendor if you reject)</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-muted">Expires (optional)</span>
                    <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={fieldClass} />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button disabled={busy === doc.id} onClick={() => review(doc, "APPROVED")}>
                      {busy === doc.id ? "Saving…" : "Approve"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-warning"
                      disabled={busy === doc.id}
                      onClick={() => {
                        if (window.confirm(`Reject “${doc.fileName || doc.kind}”? The vendor is emailed your note and asked for a new one.`)) {
                          void review(doc, "REJECTED");
                        }
                      }}
                    >
                      Reject
                    </Button>
                    {doc.status !== "PENDING" ? (
                      <Button variant="ghost" disabled={busy === doc.id} onClick={() => review(doc, "PENDING")}>
                        Back to pending
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={() => setOpen(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
