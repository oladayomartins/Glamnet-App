"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBendUpLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui";

/**
 * Reply to an enquiry from the inbox. The email goes to the sender with the
 * support inbox as reply-to, quoting their message, and the reply is kept
 * on the enquiry.
 */
export function ReplyBox({ id, name, email, open }: { id: string; name: string; email: string; open: boolean }) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState("");
  const [resolve, setResolve] = useState(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!writing) {
    return (
      <Button onClick={() => setWriting(true)}>
        <ArrowBendUpLeft size={15} weight="bold" aria-hidden /> Reply
      </Button>
    );
  }

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/${id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, resolve }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error?.issues?.[0]?.message ?? payload.error?.message ?? "Couldn't send that. Please try again.");
      }
      if (!payload.emailed) {
        window.alert(
          `Your reply was saved, but the email to ${email} couldn't be sent, so the enquiry is still open. Check the email settings, or reply from your own inbox.`,
        );
      }
      setMessage("");
      setWriting(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 w-full space-y-2 rounded-glam border border-accent-500/50 p-3">
      <label className="block">
        <span className="text-xs text-ink-muted">
          Reply to {name} &lt;{email}&gt;. Their message is quoted below yours.
        </span>
        <textarea
          autoFocus
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={10_000}
          placeholder={`Hi ${name.split(/\s+/)[0] || name}, …`}
          className="mt-1.5 w-full rounded-glam-input border border-line bg-surface p-3 text-[15px] text-ink outline-none focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15"
        />
      </label>
      {open ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Mark resolved after sending
        </label>
      ) : null}
      {error ? <p className="text-xs text-warning">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={busy || message.trim().length < 2} onClick={() => void send()}>
          {busy ? "Sending…" : "Send reply"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setWriting(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
