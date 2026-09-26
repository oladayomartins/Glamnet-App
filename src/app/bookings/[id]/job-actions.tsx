"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationArrow } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { nextStatusFor, type BookingStatus } from "@/lib/domain/types";
import { REQUIRED_COMPLETION_PHOTOS } from "@/lib/domain/completion";

/**
 * The vendor action ladder (§P-05).
 *
 * One primary action at a time, and it is always the single legal next step:
 * the lifecycle is strictly linear, so offering a menu would only offer
 * transitions the server is going to refuse. The label names the step in the
 * vendor's words — "On my way" rather than "PROVIDER_EN_ROUTE".
 */
const ACTION_LABELS: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: "Confirm this job",
  CONFIRMED: "Unlock the address",
  ADDRESS_UNLOCKED: "On my way",
  PROVIDER_EN_ROUTE: "Arrived",
  ARRIVED: "Start",
};

/** Same ladder, in the words that fit a client coming to the vendor. */
const PREMISES_LABELS: Partial<Record<BookingStatus, string>> = {
  CONFIRMED: "Client has arrived",
};

/** What each step means, so nobody taps one to find out. */
const ACTION_NOTES: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: "Confirms the slot with the customer and holds your calendar.",
  CONFIRMED:
    "Releases the customer's street address to you. Do this when you are about to set off.",
  ADDRESS_UNLOCKED: "Tells the customer you have left and started travelling.",
  PROVIDER_EN_ROUTE: "Marks you as at the door.",
  ARRIVED: "Starts the appointment.",
};

export function JobActions({
  bookingId,
  status,
  serviceLocation,
  addressLine,
  addressUnlocked,
  paymentStatus,
  imageUploadsEnabled,
  mayCancel = false,
  noShowFrom = null,
  noShowFromLabel = null,
}: {
  bookingId: string;
  status: string;
  serviceLocation: string;
  addressLine: string;
  addressUnlocked: boolean;
  paymentStatus: string;
  imageUploadsEnabled: boolean;
  /** The vendor can still call this job off (free for the client). */
  mayCancel?: boolean;
  /** ISO time from which the client can be marked a no-show, if at all. */
  noShowFrom?: string | null;
  noShowFromLabel?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atPremises = serviceLocation === "VENDOR_PREMISES";
  const next = nextStatusFor(status as BookingStatus, serviceLocation);
  const label =
    (atPremises ? PREMISES_LABELS[status as BookingStatus] : undefined) ??
    ACTION_LABELS[status as BookingStatus];

  // A storefront booking is not the vendor's to start until the card hold
  // is in place.
  if (paymentStatus === "AUTHORISATION_FAILED") {
    return (
      <Card className="border-warning/60 p-4">
        <SectionTitle>Waiting on the client&rsquo;s card</SectionTitle>
        <p className="text-sm text-ink-muted">
          We couldn&rsquo;t hold the client&rsquo;s payment, and we&rsquo;ve asked them to update their card. If
          it isn&rsquo;t sorted a day before the appointment, the booking is cancelled and you&rsquo;ll be told —
          please don&rsquo;t travel until this message has gone.
        </p>
      </Card>
    );
  }

  if (paymentStatus === "PENDING_AUTHORISATION") {
    return (
      <Card className="p-4">
        <SectionTitle>Your next step</SectionTitle>
        <p className="text-sm text-ink-muted">
          Waiting for the client to authorise their card. The slot is held for 30 minutes.
        </p>
      </Card>
    );
  }

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Could not update this job.");
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this job.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle>Your next step</SectionTitle>

      {/* The address exists on the booking from the moment it is placed, but
          the vendor does not see it until the lifecycle says so. */}
      {atPremises ? (
        <p className="mb-4 rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
          The client is coming to your workspace.
        </p>
      ) : addressUnlocked && addressLine ? (
        <div className="mb-4 rounded-glam-sm bg-sunken p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Address
          </p>
          <p className="mt-1 text-[15px] text-ink">{addressLine}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
          >
            <NavigationArrow size={16} weight="light" aria-hidden />
            Open in maps
          </a>
        </div>
      ) : (
        <p className="mb-4 rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
          The street address is released when you unlock it, just before you set
          off. Until then you have the sector.
        </p>
      )}

      {status === "IN_PROGRESS" ? (
        <CheckoutRelease
          bookingId={bookingId}
          imageUploadsEnabled={imageUploadsEnabled}
          onDone={() => router.refresh()}
        />
      ) : status === "COMPLETED" ? (
        <PinEntry bookingId={bookingId} onDone={() => router.refresh()} />
      ) : label && next ? (
        <>
          <Button onClick={advance} disabled={busy} className="w-full">
            {busy ? "Saving…" : label}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">
            {ACTION_NOTES[status as BookingStatus]}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Nothing to do here. This job is with the customer now.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-warning">
          {error}
        </p>
      ) : null}

      {noShowFrom ? <NoShow bookingId={bookingId} from={noShowFrom} fromLabel={noShowFromLabel} onDone={() => router.refresh()} /> : null}
      {mayCancel ? <VendorCancel bookingId={bookingId} onDone={() => router.refresh()} /> : null}
    </Card>
  );
}

/**
 * [ Client didn't show ]. Available from the door (or, at the vendor's own
 * workspace, while waiting) fifteen minutes after the start. Charges the
 * missed-appointment fee; the client can dispute it for 24 hours, and the
 * arrival time on the job is the evidence.
 */
function NoShow({
  bookingId,
  from,
  fromLabel,
  onDone,
}: {
  bookingId: string;
  from: string;
  fromLabel: string | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ready = now >= new Date(from).getTime();

  const mark = async () => {
    setNow(Date.now());
    if (!window.confirm("Mark the client as a no-show? They'll be charged the missed-appointment fee, and can dispute it if they were there.")) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/bookings/${bookingId}/no-show`);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <Button variant="secondary" onClick={mark} disabled={busy || !ready} className="w-full">
        {busy ? "Saving…" : "Client didn\u2019t show"}
      </Button>
      <p className="mt-2 text-center text-xs text-ink-muted">
        {ready
          ? "Tried calling? If they're not here, this charges the missed-appointment fee and frees your time."
          : `Available from ${fromLabel ?? "15 minutes after the start"} — give the client 15 minutes.`}
      </p>
      {!ready ? (
        <button type="button" onClick={() => setNow(Date.now())} className="tap-44 w-full text-center text-xs text-ink-muted hover:text-ink">
          Check again
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** [ Cancel this job ] — free for the client, and the reason goes to them. */
function VendorCancel({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(`/api/bookings/${bookingId}/cancel`, { reason });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-44 mt-3 w-full text-center text-xs text-ink-muted hover:text-ink"
      >
        Can&rsquo;t make it? Cancel this job
      </button>
    );
  }

  return (
    <form onSubmit={cancel} className="mt-4 space-y-3 border-t border-line pt-4">
      <p className="text-sm text-ink">
        Your client isn&rsquo;t charged and their card hold is released. Cancelling close to the appointment lets a
        client down, so please only do it if you have to — the team keeps an eye on late cancellations.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-ink">Why? Your client will see this.</span>
        <textarea
          required
          minLength={5}
          maxLength={500}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-accent-500"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={busy || reason.trim().length < 5}>
          {busy ? "Cancelling…" : "Cancel this job"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Keep it
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}
    </form>
  );
}

async function post(url: string, body?: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "That did not work.");
  return payload;
}

/**
 * [ Request Checkout Release ]: three photos of the finished style, taken
 * with the phone camera, before the client's PIN is issued.
 */
function CheckoutRelease({
  bookingId,
  imageUploadsEnabled,
  onDone,
}: {
  bookingId: string;
  imageUploadsEnabled: boolean;
  onDone: () => void;
}) {
  const [photos, setPhotos] = useState<(UploadedImage | null)[]>(() =>
    Array.from({ length: REQUIRED_COMPLETION_PHOTOS }, () => null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = photos.every(Boolean);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/bookings/${bookingId}/checkout-release`, { photos });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  if (!imageUploadsEnabled) {
    return (
      <p role="alert" className="text-sm text-warning">
        Photo uploads are not configured on this deployment, so this job cannot be
        checked out. Ask an admin to connect the media library.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        Finished? Take {REQUIRED_COMPLETION_PHOTOS} clear photos of the finished work. They are
        kept as the record of the job, then your client gets a PIN to release payment.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <ImageUpload
            key={index}
            folder="completion"
            capture="environment"
            label={`Photo ${index + 1}`}
            value={photo}
            disabled={busy}
            onChange={(image) =>
              setPhotos((current) => current.map((entry, at) => (at === index ? image : entry)))
            }
          />
        ))}
      </div>
      <Button onClick={submit} disabled={!ready || busy} className="w-full">
        {busy ? "Sending…" : "Request checkout release"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The client reads their 4-digit PIN aloud; the vendor types it here. */
function PinEntry({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const release = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await post(`/api/bookings/${bookingId}/release`, { pin });
      onDone();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const reissue = async () => {
    setBusy(true);
    try {
      await post(`/api/bookings/${bookingId}/checkout-release`, undefined, "PUT");
      setMessage("A new PIN is on your client's screen.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={release} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-ink">Client&rsquo;s 4-digit PIN</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{4}"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          className="mt-1 min-h-14 w-full rounded-glam-input border border-line bg-surface px-3 text-center font-mono text-3xl tracking-[0.5em] text-ink outline-none focus:border-accent-500"
        />
      </label>
      <Button type="submit" disabled={busy || pin.length !== 4} className="w-full">
        {busy ? "Checking…" : "Release payment"}
      </Button>
      <button
        type="button"
        onClick={reissue}
        disabled={busy}
        className="tap-44 w-full text-center text-xs text-ink-muted hover:text-ink"
      >
        Send the client a new PIN
      </button>
      {message ? (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      ) : null}
    </form>
  );
}
