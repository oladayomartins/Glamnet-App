"use client";

import { useEffect, useState } from "react";
import { Bell, BellSlash, DeviceMobile } from "@phosphor-icons/react";
import { Button } from "@/components/ui";

type State = "loading" | "hidden" | "ios-install" | "denied" | "off" | "on" | "busy";

const COPY = {
  PROVIDER: {
    title: "Get booking requests on your phone",
    body: "Emergency requests go to the first pro who says yes. Turn on notifications so you hear about them even with GLAMNET closed.",
  },
  CUSTOMER: {
    title: "Know the moment something changes",
    body: "Get a notification when a pro accepts, when your checkout PIN is ready, and if anything needs your attention.",
  },
  ADMIN: {
    title: "Get alerts for disputes and chargebacks",
    body: "Be told straight away when a customer raises a dispute or a card chargeback comes in.",
  },
} as const;

function vapidKey(): Uint8Array | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Turn push notifications on or off for this device.
 *
 * Shown as a card while off, and as a quiet line once on. On an iPhone,
 * Safari only allows web push for an app added to the home screen, so it
 * explains that instead of offering a button that can't work.
 */
export function PushPrompt({ audience }: { audience: keyof typeof COPY }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settle = (next: State) => {
        if (!cancelled) setState(next);
      };
      if (!vapidKey()) return settle("hidden");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return settle(isIos() && !isStandalone() ? "ios-install" : "hidden");
      if (Notification.permission === "denied") return settle("denied");
      try {
        const subscription = await currentSubscription();
        settle(subscription && Notification.permission === "granted" ? "on" : "off");
      } catch {
        settle("hidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setState("busy");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey() as BufferSource,
        }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Couldn't turn notifications on.");
      }
      setState("on");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't turn notifications on.");
      setState("off");
    }
  };

  const turnOff = async () => {
    setState("busy");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  };

  if (state === "loading" || state === "hidden") return null;

  if (state === "on") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <Bell size={16} weight="fill" className="text-accent-700" aria-hidden />
        Notifications are on for this device.
        <button type="button" onClick={turnOff} className="font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Turn off
        </button>
      </p>
    );
  }

  const copy = COPY[audience];
  return (
    <div className="rounded-glam border border-accent-500/40 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-metal text-metal-ink">
          {state === "ios-install" ? <DeviceMobile size={20} aria-hidden /> : state === "denied" ? <BellSlash size={20} aria-hidden /> : <Bell size={20} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-ink">{copy.title}</p>
          {state === "ios-install" ? (
            <p className="mt-1 text-sm text-ink-muted">
              On iPhone, notifications work once GLAMNET is on your home screen: tap{" "}
              <span className="font-semibold text-ink">Share</span>, then{" "}
              <span className="font-semibold text-ink">Add to Home Screen</span>, and open GLAMNET from there.
            </p>
          ) : state === "denied" ? (
            <p className="mt-1 text-sm text-ink-muted">
              Notifications are blocked for this site. Allow them in your browser&rsquo;s site settings, then come back
              here.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-muted">{copy.body}</p>
              <Button onClick={turnOn} disabled={state === "busy"} className="mt-3">
                {state === "busy" ? "Turning on…" : "Turn on notifications"}
              </Button>
            </>
          )}
          {error ? (
            <p role="alert" className="mt-2 text-sm text-warning">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
