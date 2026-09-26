"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Broadcast } from "@phosphor-icons/react";
import { EmptyState, SectionTitle } from "@/components/ui";
import { track } from "@/lib/analytics";
import { BroadcastTicket, type BroadcastRequest } from "./broadcast-ticket";
import { publishRequestCount, requestVendorRefresh, useVendorRefresh } from "./vendor-events";

/** How often the inbox checks for new requests while it is on screen. */
const POLL_MS = 30_000;

/**
 * The vendor's open booking requests, most urgent first.
 *
 * Emergency tickets come first: they have the least notice and the shortest
 * acceptance window, so burying one under three normal requests costs the
 * vendor the job. After that, the one expiring soonest.
 */
export function RequestsInbox({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<BroadcastRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Bumped to pull fresh data; the fetch itself lives in the effect below so
  // nothing sets state synchronously during render.
  const [reloadToken, setReloadToken] = useState(0);
  useVendorRefresh(() => setReloadToken((token) => token + 1));

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setReloadToken((token) => token + 1);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`/api/providers/${providerId}/requests`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Could not load your requests.");
        }
        const sorted = [...(payload.requests as BroadcastRequest[])].sort(
          (a, b) =>
            Number(b.bookingType === "EMERGENCY") - Number(a.bookingType === "EMERGENCY") ||
            Date.parse(a.acceptanceExpiresAt) - Date.parse(b.acceptanceExpiresAt),
        );
        setRequests(sorted);
        publishRequestCount(sorted.length);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load your requests.");
      }
    })();

    return () => controller.abort();
  }, [providerId, reloadToken]);

  const respond = async (bookingId: string, action: "accept" | "decline") => {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const payload = await response.json().catch(() => null);
      if (action === "accept") {
        track("vendor_accept_booking", { outcome: response.ok ? "accepted" : "failed" });
      } else {
        track("vendor_decline_booking", { outcome: response.ok ? "declined" : "failed" });
      }
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? `Could not ${action} this booking.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} this booking.`);
    } finally {
      setBusyId(null);
      // Reload everything either way: an acceptance adds to the calendar and
      // today's figures, and on a lost race the request should disappear.
      requestVendorRefresh();
      router.refresh();
    }
  };

  const open = requests ?? [];

  return (
    <section id="requests" className="scroll-mt-20">
      <SectionTitle
        hint={
          requests === null
            ? null
            : open.length === 0
              ? "No open requests"
              : `${open.length} awaiting your response`
        }
      >
        Booking requests
      </SectionTitle>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}

      {requests === null ? (
        <p className="text-sm text-ink-muted">Loading requests…</p>
      ) : open.length === 0 ? (
        <EmptyState
          icon={<Broadcast size={24} weight="light" />}
          title="No requests yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/provider/${providerId}#bio-link`}
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
              >
                Share your booking link
              </Link>
              <Link
                href={`/provider/${providerId}/availability`}
                className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-sunken"
              >
                Set your hours
              </Link>
            </div>
          }
        >
          When a client nearby books your kind of service, we&rsquo;ll notify you
          instantly — tap the notification to accept before the timer runs out.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {open.map((request) => (
            <BroadcastTicket
              key={request.bookingId}
              request={request}
              busy={busyId === request.bookingId}
              onAccept={() => respond(request.bookingId, "accept")}
              onDecline={() => respond(request.bookingId, "decline")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
