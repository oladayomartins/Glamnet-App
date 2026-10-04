"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatCircleDots, PaperPlaneRight } from "@phosphor-icons/react";
import { Card, SectionTitle } from "@/components/ui";
import { formatCustomerDayTime } from "@/lib/format";

export interface ThreadMessage {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

/** How often an open thread checks for replies. */
const POLL_MS = 15_000;
const MAX_LENGTH = 1_000;

/**
 * The message thread on a booking, between the client and the vendor.
 *
 * Polls while the tab is visible rather than holding a socket open: messages
 * here are "running ten minutes late", not live chat, and a push notification
 * already reaches whoever is away from the page.
 */
export function BookingMessages({
  bookingId,
  viewerRole,
  otherName,
  initial,
  open,
}: {
  bookingId: string;
  viewerRole: "CUSTOMER" | "PROVIDER" | "ADMIN";
  otherName: string;
  initial: ThreadMessage[];
  open: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/messages`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { messages: ThreadMessage[] };
      setMessages(payload.messages.map((message) => ({ ...message, createdAt: String(message.createdAt) })));
    } catch {
      // The next poll tries again.
    }
  }, [bookingId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, refresh]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Your message didn't send.");
      setMessages((current) => [...current, { ...payload.message, createdAt: String(payload.message.createdAt) }]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your message didn't send.");
    } finally {
      setBusy(false);
    }
  };

  const mine = (role: string) => role === viewerRole;
  const label = (role: string) =>
    viewerRole === "ADMIN" ? (role === "CUSTOMER" ? "Client" : "Vendor") : mine(role) ? "You" : otherName;

  return (
    <Card className="p-4">
      <SectionTitle hint={viewerRole === "ADMIN" ? "Read-only for support" : undefined}>
        {viewerRole === "ADMIN" ? "Messages" : `Messages with ${otherName}`}
      </SectionTitle>

      {messages.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <ChatCircleDots size={18} aria-hidden />
          {open
            ? viewerRole === "PROVIDER"
              ? "Running late, or need to check something? Send your client a message."
              : "Questions about your appointment? Send a message."
            : "No messages on this booking."}
        </p>
      ) : (
        <ol
          ref={listRef}
          aria-live="polite"
          className="max-h-96 space-y-2 overflow-y-auto pr-1"
        >
          {messages.map((message) => (
            <li key={message.id} className={`flex ${mine(message.senderRole) ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-glam px-3 py-2 ${
                  mine(message.senderRole) ? "bg-accent-100/60 text-ink" : "bg-sunken text-ink"
                }`}
              >
                <p className="whitespace-pre-line break-words text-[15px]">{message.body}</p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {label(message.senderRole)} · {formatCustomerDayTime(message.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {open ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor={`message-${bookingId}`}>
            Message {otherName}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={`message-${bookingId}`}
              value={draft}
              maxLength={MAX_LENGTH}
              rows={2}
              placeholder={`Message ${otherName}…`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="min-h-12 flex-1 rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none transition duration-[180ms] focus:border-accent-500"
            />
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              aria-label="Send message"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-metal text-metal-ink transition duration-[180ms] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PaperPlaneRight size={20} weight="fill" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Keep payments on GLAMNET — your booking is only protected here.
          </p>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
