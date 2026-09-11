"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlamNetPin } from "@/components/brand";
import { BookingTypeTag, Button } from "@/components/ui";
import { BROADCAST_ACCEPTANCE_WINDOW_MINUTES } from "@/lib/domain/constants";

/** How often to ask whether anybody has taken the job. */
const POLL_MS = 4_000;

/**
 * Searching for a vendor (§C-08).
 *
 * A full screen, not a modal: the customer has paid and there is nothing else
 * to do on this page, so a dialog floating over a form they can no longer use
 * would be a lie about what is available.
 *
 * There is no percentage anywhere, because the wait length is genuinely
 * unknown — a progress bar that claims 60% would be invented. What moves is a
 * shimmer, and exactly one pulse ring on the pin.
 */
export function SearchingForProvider({
  bookingId,
  bookingType,
  sector,
  onTryAnotherTime,
}: {
  bookingId: string;
  bookingType: string;
  sector: string;
  /** Hands the customer back to the picker with their basket intact. */
  onTryAnotherTime: () => void;
}) {
  const [outcome, setOutcome] = useState<"searching" | "accepted" | "expired">(
    "searching",
  );
  const [broadcastCount, setBroadcastCount] = useState<number | null>(null);

  useEffect(() => {
    if (outcome !== "searching") return;

    const controller = new AbortController();
    // An absolute deadline, so a backgrounded tab does not extend the wait.
    const deadline =
      Date.now() + BROADCAST_ACCEPTANCE_WINDOW_MINUTES * 60 * 1_000;

    const check = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const { booking } = await response.json();

        setBroadcastCount(booking.broadcasts?.length ?? null);

        if (booking.providerId) {
          setOutcome("accepted");
          return;
        }
        if (Date.now() > deadline) setOutcome("expired");
      } catch {
        // A failed poll is not an outcome. The next tick tries again, and the
        // deadline still decides when to stop waiting.
      }
    };

    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [bookingId, outcome]);

  if (outcome === "accepted") {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Someone has taken it
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-muted">
          Your vendor is confirmed. You can follow them from here right up to
          the door.
        </p>
        <Link href={`/bookings/${bookingId}`} className="mt-7 inline-flex">
          <Button>Track this booking</Button>
        </Link>
      </div>
    );
  }

  if (outcome === "expired") {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Nobody was free in time
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-muted">
          Your payment has not been taken. Two things usually work: a different
          time on the same day, or the same time in a neighbouring sector.
        </p>
        {/* Never dump the customer back to an empty picker with no
            explanation — both ways forward are named and one tap away. */}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={onTryAnotherTime}>Try another time</Button>
          <Link href="/search">
            <Button variant="secondary">Widen the area</Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          <Link href={`/bookings/${bookingId}`} className="hover:underline">
            See the request we sent
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="py-16 text-center">
      {/* One pulsing element on the screen, and it is this. */}
      <span className="pulse-ring relative mx-auto flex h-16 w-16 items-center justify-center rounded-full text-brand-400">
        <GlamNetPin size={34} dotClassName="bg-canvas" />
      </span>

      <div className="mt-8">
        <BookingTypeTag bookingType={bookingType} />
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
        Finding you a vendor
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-muted">
        We have broadcast your request to
        {broadcastCount === null
          ? " up to five"
          : ` ${broadcastCount}`}{" "}
        vetted {broadcastCount === 1 ? "provider" : "providers"} in {sector} who
        are free for your whole appointment. The first to accept takes the job,
        and we will tell you the moment one does.
      </p>

      {/* A shimmer, not a percentage: we do not know how long this takes. */}
      <div
        role="status"
        aria-label="Waiting for a vendor to accept"
        className="shimmer mx-auto mt-8 h-1.5 w-full max-w-sm rounded-full"
      />

      <p className="mt-6 text-xs text-ink-muted">
        Your card is authorised, not charged. If nobody accepts, the
        authorisation is released.
      </p>
    </div>
  );
}
