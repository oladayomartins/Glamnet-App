"use client";

import { useState, type ReactNode } from "react";
import {
  AndroidLogo,
  AppleLogo,
  CheckCircle,
  Desktop,
  DeviceMobile,
  DotsThreeVertical,
  Export,
  List,
  PlusSquare,
} from "@phosphor-icons/react";
import { Button, Card } from "@/components/ui";
import { track } from "@/lib/analytics";
import { promptInstall, useInstallState, usePlatform, type Platform } from "@/components/pwa/install-state";

type Tab = "iphone" | "android" | "samsung" | "computer" | "mac";

const TABS: Array<{ key: Tab; label: string; icon: ReactNode }> = [
  { key: "iphone", label: "iPhone & iPad", icon: <AppleLogo size={16} aria-hidden /> },
  { key: "android", label: "Android", icon: <AndroidLogo size={16} aria-hidden /> },
  { key: "samsung", label: "Samsung Internet", icon: <DeviceMobile size={16} aria-hidden /> },
  { key: "computer", label: "Chrome or Edge", icon: <Desktop size={16} aria-hidden /> },
  { key: "mac", label: "Safari on Mac", icon: <AppleLogo size={16} aria-hidden /> },
];

const TAB_FOR: Record<Platform, Tab> = {
  ios: "iphone",
  ipad: "iphone",
  android: "android",
  samsung: "samsung",
  "desktop-chromium": "computer",
  "desktop-safari": "mac",
  firefox: "computer",
  other: "android",
};

function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-metal font-mono text-xs font-bold text-metal-ink">
        {n}
      </span>
      <span className="pt-0.5 text-[15px] text-ink">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;

function panels(site: ReactNode): Record<Tab, ReactNode> {
  return {
  iphone: (
    <>
      <Steps>
        <Step n={1}>
          Open <Key>{site}</Key> in <Key>Safari</Key>. (Chrome on iPhone works too on iOS 16.4 or later.)
        </Step>
        <Step n={2}>
          Tap the <Key>Share</Key> button <Export size={18} className="inline align-text-bottom text-accent-700" aria-label="Share icon" /> — at
          the bottom of the screen on iPhone, top right on iPad.
        </Step>
        <Step n={3}>
          Scroll down and tap <Key>Add to Home Screen</Key>{" "}
          <PlusSquare size={18} className="inline align-text-bottom text-accent-700" aria-hidden />. If you don&rsquo;t see it, tap{" "}
          <Key>Edit Actions</Key> at the bottom of the list and add it.
        </Step>
        <Step n={4}>
          Keep the name <Key>GLAMNET</Key> and tap <Key>Add</Key>. The GLAMNET icon appears on your home screen.
        </Step>
        <Step n={5}>
          <Key>Open GLAMNET from the new icon</Key> — not from Safari — and sign in. Notifications on iPhone only work in
          the app opened from the home screen.
        </Step>
      </Steps>
      <p className="mt-4 rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
        Notifications need iOS or iPadOS 16.4 or later. Check in <Key>Settings → General → About</Key>.
      </p>
    </>
  ),
  android: (
    <Steps>
      <Step n={1}>
        Open <Key>{site}</Key> in <Key>Chrome</Key>.
      </Step>
      <Step n={2}>
        If a bar offers <Key>Install app</Key>, tap it. Otherwise tap the menu{" "}
        <DotsThreeVertical size={18} weight="bold" className="inline align-text-bottom text-accent-700" aria-label="three dots" /> at the top
        right.
      </Step>
      <Step n={3}>
        Tap <Key>Install app</Key> (on some phones it says <Key>Add to Home screen</Key>), then <Key>Install</Key>.
      </Step>
      <Step n={4}>
        GLAMNET appears on your home screen and in your app drawer. Open it from there and sign in.
      </Step>
    </Steps>
  ),
  samsung: (
    <Steps>
      <Step n={1}>
        Open <Key>{site}</Key> in <Key>Samsung Internet</Key>.
      </Step>
      <Step n={2}>
        Tap the menu <List size={18} weight="bold" className="inline align-text-bottom text-accent-700" aria-label="menu" /> at the bottom right.
      </Step>
      <Step n={3}>
        Tap <Key>Add page to</Key>, then <Key>Home screen</Key>, then <Key>Add</Key>. (If the address bar shows a download
        icon, tapping it installs straight away.)
      </Step>
      <Step n={4}>Open GLAMNET from the new icon and sign in.</Step>
    </Steps>
  ),
  computer: (
    <>
      <Steps>
        <Step n={1}>
          Open <Key>{site}</Key> in <Key>Google Chrome</Key> or <Key>Microsoft Edge</Key>.
        </Step>
        <Step n={2}>
          Click the install icon at the right of the address bar (a screen with a down arrow), or open the browser menu and
          choose <Key>Cast, save and share → Install GLAMNET</Key> (Chrome) or <Key>Apps → Install GLAMNET</Key> (Edge).
        </Step>
        <Step n={3}>
          Click <Key>Install</Key>. GLAMNET opens in its own window and is added to your Start menu, Dock or Launchpad.
        </Step>
      </Steps>
      <p className="mt-4 rounded-glam-sm bg-sunken p-3 text-sm text-ink-muted">
        Firefox can&rsquo;t install web apps. You can still use GLAMNET in Firefox, and turn on notifications there.
      </p>
    </>
  ),
  mac: (
    <Steps>
      <Step n={1}>
        Open <Key>{site}</Key> in <Key>Safari</Key> (macOS Sonoma or later).
      </Step>
      <Step n={2}>
        In the menu bar choose <Key>File → Add to Dock</Key>, then click <Key>Add</Key>.
      </Step>
      <Step n={3}>Open GLAMNET from the Dock and sign in.</Step>
    </Steps>
  ),
  };
}

/**
 * Install instructions for every common phone and computer, opened at the
 * reader's own, with the browser's one-tap install where it offers one.
 */
export function InstallGuide({ host }: { host: string }) {
  const PANELS = panels(host);
  const { canPrompt, installed } = useInstallState();
  const platform = usePlatform();
  // Opens at the reader's own device until they pick another.
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab = chosen ?? TAB_FOR[platform];
  const [justInstalled, setJustInstalled] = useState(false);

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "unavailable") return;
    track("pwa_install_prompt", { outcome, platform, surface: "guide" });
    if (outcome === "accepted") setJustInstalled(true);
  };

  return (
    <div className="space-y-6">
      {installed || justInstalled ? (
        <Card className="flex items-start gap-3 border-normal/30 p-4">
          <CheckCircle size={24} weight="fill" className="shrink-0 text-normal" aria-hidden />
          <div>
            <p className="font-semibold text-ink">GLAMNET is installed on this device</p>
            <p className="text-sm text-ink-muted">Open it from your home screen, Dock or Start menu. Now turn on notifications below.</p>
          </div>
        </Card>
      ) : canPrompt ? (
        <Card className="flex flex-wrap items-center gap-4 border-accent-500/40 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon */}
          <img src="/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 rounded-[14px] shadow-card" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Your browser can install GLAMNET in one tap</p>
            <p className="text-sm text-ink-muted">No app store, nothing to pay, and it takes up almost no space.</p>
          </div>
          <Button onClick={install}>
            <DeviceMobile size={16} aria-hidden /> Install GLAMNET
          </Button>
        </Card>
      ) : null}

      <div>
        <div role="tablist" aria-label="Your device" className="flex flex-wrap gap-1.5">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              id={`tab-${entry.key}`}
              aria-selected={tab === entry.key}
              aria-controls={`panel-${entry.key}`}
              onClick={() => setChosen(entry.key)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
                tab === entry.key ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {entry.icon}
              {entry.label}
            </button>
          ))}
        </div>
        {TABS.map((entry) => (
          <div
            key={entry.key}
            role="tabpanel"
            id={`panel-${entry.key}`}
            aria-labelledby={`tab-${entry.key}`}
            hidden={tab !== entry.key}
            className="mt-4"
          >
            <Card className="p-5">{PANELS[entry.key]}</Card>
          </div>
        ))}
      </div>
    </div>
  );
}
