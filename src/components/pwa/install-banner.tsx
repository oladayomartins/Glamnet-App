"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeviceMobile, Export, PlusSquare, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { track } from "@/lib/analytics";
import { promptInstall, useInstallState, usePlatform } from "./install-state";

const DISMISSED_KEY = "glamnet:install-dismissed-at";
const VIEWS_KEY = "glamnet:page-views";
/** Asked again this long after "Not now". */
const SNOOZE_DAYS = 21;
/** Pages seen in this tab before the banner appears: interest, not a first glance. */
const VIEWS_BEFORE_ASKING = 2;
/** …or this long on the first page. */
const DELAY_MS = 25_000;

/** Never interrupt someone mid-booking, signing in, or already reading how. */
const QUIET_PATHS = [/^\/book(\/|$)/, /^\/sign-(in|up)/, /^\/auth/, /^\/install/, /\/checkout/, /^\/unsubscribe/];

const STORAGE_EVENT = "glamnet:install-storage";

function storage(kind: "local" | "session"): Storage | undefined {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function readNumber(kind: "local" | "session", key: string): number {
  try {
    return Number(storage(kind)?.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(kind: "local" | "session", key: string, value: string) {
  try {
    storage(kind)?.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the banner just asks again next time.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => window.removeEventListener(STORAGE_EVENT, onChange);
}

/** Snoozed by "Not now" recently. True on the server, so nothing renders there. */
function useSnoozed(): boolean {
  return useSyncExternalStore(
    subscribeStorage,
    () => {
      const at = readNumber("local", DISMISSED_KEY);
      return at > 0 && Date.now() - at < SNOOZE_DAYS * 86_400_000;
    },
    () => true,
  );
}

/** Pages seen in this tab. */
function useViews(): number {
  return useSyncExternalStore(subscribeStorage, () => readNumber("session", VIEWS_KEY), () => 0);
}

/**
 * "Add GLAMNET to your home screen", once someone has shown some interest.
 *
 * Where the browser can install in one tap (Chrome, Edge, Samsung Internet)
 * it offers that button. On iPhone and iPad, where only Safari's Share menu
 * can, it shows those two steps instead. Elsewhere (Firefox on a computer)
 * installing isn't possible, so it stays quiet. "Not now" holds it back for
 * three weeks; it never shows inside the installed app.
 */
export function InstallBanner() {
  const pathname = usePathname();
  const { canPrompt, installed } = useInstallState();
  const platform = usePlatform();
  const snoozed = useSnoozed();
  const views = useViews();
  const [waited, setWaited] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Count this page view; storage changes reach the hooks above.
  useEffect(() => {
    write("session", VIEWS_KEY, String(readNumber("session", VIEWS_KEY) + 1));
  }, [pathname]);

  // …or ask after a while on the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const ready = waited || views >= VIEWS_BEFORE_ASKING;
  const apple = platform === "ios" || platform === "ipad";
  const quiet = QUIET_PATHS.some((pattern) => pattern.test(pathname));
  const visible = ready && !snoozed && !hidden && !installed && !quiet && (canPrompt || apple);

  useEffect(() => {
    if (visible) track("pwa_install_prompt", { outcome: "shown", platform, surface: "banner" });
  }, [visible, platform]);

  if (!visible) return null;

  const dismiss = () => {
    write("local", DISMISSED_KEY, String(Date.now()));
    setHidden(true);
    track("pwa_install_prompt", { outcome: "dismissed", platform, surface: "banner" });
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      track("pwa_install_prompt", { outcome: "accepted", platform, surface: "banner" });
      setHidden(true);
    } else if (outcome === "dismissed") {
      dismiss();
    }
  };

  return (
    <aside
      aria-label="Install the GLAMNET app"
      className="rise-in fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-glam-lg border border-accent-500/40 bg-surface p-4 shadow-card sm:inset-x-auto sm:right-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
      >
        <X size={16} aria-hidden />
      </button>
      <div className="flex items-start gap-3 pr-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon, as it will look on the phone */}
        <img src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[12px] shadow-card" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">Get the GLAMNET app</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Open it from your home screen in one tap, full screen, with booking updates as notifications. Free, and no app
            store needed.
          </p>
        </div>
      </div>

      {canPrompt ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={install}>
            <DeviceMobile size={16} aria-hidden /> Install app
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm text-ink">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-xs">1</span>
            Tap <Export size={18} className="text-accent-700" aria-label="Share" /> <strong>Share</strong>
            {platform === "ipad" ? " at the top of Safari" : " at the bottom of Safari"}
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-xs">2</span>
            Choose <PlusSquare size={18} className="text-accent-700" aria-hidden /> <strong>Add to Home Screen</strong>
          </li>
        </ol>
      )}
      <Link href="/install" className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-accent-700 hover:underline">
        Step-by-step guide for every phone →
      </Link>
    </aside>
  );
}
