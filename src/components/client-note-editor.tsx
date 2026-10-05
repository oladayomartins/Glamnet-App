"use client";

import { useState } from "react";
import { LockSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui";

/**
 * A vendor's private note on a client: allergies, the lash length they like,
 * a patch-test date. Shown read-only until Edit, so a note is not changed by
 * a stray tap on the job screen.
 */
export function ClientNoteEditor({
  customerId,
  clientName,
  initialNote,
  compact = false,
}: {
  customerId: string;
  clientName: string;
  initialNote: string;
  /** On the job page: one line of guidance, no big empty box. */
  compact?: boolean;
}) {
  const [note, setNote] = useState(initialNote);
  const [draft, setDraft] = useState(initialNote);
  const [editing, setEditing] = useState(!compact && initialNote === "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/provider/clients/${customerId}/note`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Your note didn't save.");
      setNote(payload.note.note);
      setDraft(payload.note.note);
      setEditing(false);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your note didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <LockSimple size={13} aria-hidden />
        Private — only you can see this, not {clientName.split(/\s+/)[0] || "the client"}.
      </p>

      {editing ? (
        <div className="mt-2">
          <label className="sr-only" htmlFor={`note-${customerId}`}>
            Private note about {clientName}
          </label>
          <textarea
            id={`note-${customerId}`}
            value={draft}
            maxLength={2_000}
            rows={4}
            autoFocus={note !== ""}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. Allergic to latex. Likes 14 mm lashes. Patch test done 3 Oct."
            className="w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none transition duration-[180ms] focus:border-accent-500"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || draft.trim() === note}>
              {busy ? "Saving…" : draft.trim() || !note ? "Save note" : "Clear note"}
            </Button>
            {note || compact ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(note);
                  setEditing(false);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          {note ? (
            <p className="whitespace-pre-line rounded-glam-sm bg-sunken p-3 text-[15px] text-ink">{note}</p>
          ) : (
            <p className="text-sm text-ink-muted">No notes yet.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
            className="tap-44 mt-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            {note ? "Edit note" : "Add a note"}
          </button>
          {saved ? (
            <span role="status" className="ml-3 text-sm text-ink-muted">
              Saved
            </span>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
