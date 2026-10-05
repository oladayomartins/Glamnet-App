"use client";

import { useState } from "react";
import { AppleLogo, ArrowsClockwise, CalendarCheck, Check, Copy, GoogleLogo, MicrosoftOutlookLogo } from "@phosphor-icons/react";
import { Button, Card, SectionTitle } from "@/components/ui";

type Urls = { https: string; webcal: string; google: string; outlook: string };

const LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] hover:bg-sunken";

/**
 * Calendar sync: subscribe a phone or laptop calendar to the vendor's
 * GLAMNET diary. One tap per calendar app; the link can be copied for
 * anything else, reset if it was shared by mistake, or switched off.
 */
export function CalendarSync({ initialUrls }: { initialUrls: Urls | null }) {
  const [urls, setUrls] = useState(initialUrls);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/provider/calendar-feed", { method });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "That didn't work. Please try again.");
      return payload as { urls?: Urls };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const turnOn = async () => {
    const payload = await call("POST");
    if (payload?.urls) setUrls(payload.urls);
  };

  const reset = async () => {
    if (!window.confirm("Reset the link? Calendars using the old link stop updating, and you'll need to add the new one.")) return;
    const payload = await call("POST");
    if (payload?.urls) {
      setUrls(payload.urls);
      setNotice("New link ready. Remove the old GLAMNET calendar from your app and add this one.");
    }
  };

  const turnOff = async () => {
    if (!window.confirm("Turn off calendar sync? Your calendar app will stop getting GLAMNET bookings.")) return;
    if (await call("DELETE")) {
      setUrls(null);
      setNotice("Calendar sync is off. You can remove the GLAMNET calendar from your app.");
    }
  };

  const copy = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Couldn't copy — press and hold the link to copy it instead.");
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle hint={urls ? "On" : undefined}>Sync to your phone&rsquo;s calendar</SectionTitle>
      {!urls ? (
        <>
          <p className="text-sm text-ink-muted">
            See your GLAMNET bookings and time off in Google Calendar, Apple Calendar or Outlook, next to everything
            else. New, moved and cancelled bookings update by themselves.
          </p>
          <Button onClick={turnOn} disabled={busy} className="mt-3">
            <CalendarCheck size={16} aria-hidden />
            {busy ? "Turning on…" : "Turn on calendar sync"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">Add it to your calendar app — one tap:</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <a href={urls.google} target="_blank" rel="noreferrer" className={LINK}>
              <GoogleLogo size={16} weight="bold" aria-hidden />
              Google Calendar
            </a>
            <a href={urls.webcal} className={LINK}>
              <AppleLogo size={16} weight="fill" aria-hidden />
              Apple Calendar
            </a>
            <a href={urls.outlook} target="_blank" rel="noreferrer" className={LINK}>
              <MicrosoftOutlookLogo size={16} weight="bold" aria-hidden />
              Outlook
            </a>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-glam-sm bg-sunken p-2 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted" title={urls.https}>
              {urls.https}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink hover:bg-surface"
            >
              {copied ? <Check size={14} weight="bold" aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <p className="mt-2 text-xs text-ink-muted">
            Keep this link to yourself — anyone with it can see your booking times and clients&rsquo; first names.
            Apple and Outlook check for changes every hour or so; Google can take several hours.
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4">
            <button type="button" onClick={reset} disabled={busy} className="tap-44 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50">
              <ArrowsClockwise size={14} aria-hidden />
              Reset link
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className="tap-44 text-sm font-semibold text-ink-muted hover:text-ink disabled:opacity-50">
              Turn off
            </button>
          </div>
        </>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-ink">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
