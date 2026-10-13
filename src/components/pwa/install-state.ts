"use client";

import { useSyncExternalStore } from "react";

/**
 * What the browser lets us do about installing GLAMNET, shared by the
 * install banner and the install guide.
 *
 * Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once, early —
 * often before React has hydrated — so an inline script in the root layout
 * (INSTALL_CAPTURE_SCRIPT) catches it onto `window` and this store picks it
 * up. Safari never fires it: on iPhone and iPad installing is always Share →
 * Add to Home Screen, which we can only explain.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __glamnetInstallPrompt?: BeforeInstallPromptEvent | null;
    __glamnetInstalled?: boolean;
  }
}

export type Platform = "ios" | "ipad" | "android" | "samsung" | "desktop-chromium" | "desktop-safari" | "firefox" | "other";

/** Runs before hydration: keeps the one-shot install event for later. */
export const INSTALL_CAPTURE_SCRIPT = `(function(){window.__glamnetInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__glamnetInstallPrompt=e;window.dispatchEvent(new Event("glamnet:installable"));});window.addEventListener("appinstalled",function(){window.__glamnetInstalled=true;window.__glamnetInstallPrompt=null;window.dispatchEvent(new Event("glamnet:installable"));});})();`;

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || iPadOs) return "ipad";
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\/|Chrome\//.test(ua)) return "desktop-chromium";
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return "desktop-safari";
  return "other";
}

/** Running as the installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export interface InstallState {
  /** The browser offered a one-tap install, ready to show. */
  canPrompt: boolean;
  /** Already installed, or running as the app. */
  installed: boolean;
}

const SERVER: InstallState = { canPrompt: false, installed: false };
let cached: InstallState = SERVER;

function read(): InstallState {
  const next = {
    canPrompt: Boolean(window.__glamnetInstallPrompt),
    installed: Boolean(window.__glamnetInstalled) || isStandalone(),
  };
  if (next.canPrompt !== cached.canPrompt || next.installed !== cached.installed) cached = next;
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener("glamnet:installable", onChange);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("glamnet:installable", onChange);
    media.removeEventListener("change", onChange);
  };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

/** Show the browser's own install dialog. Resolves with what the person chose. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = window.__glamnetInstallPrompt;
  if (!event) return "unavailable";
  await event.prompt();
  const { outcome } = await event.userChoice;
  // The event can only be used once, whatever the answer.
  window.__glamnetInstallPrompt = null;
  window.dispatchEvent(new Event("glamnet:installable"));
  return outcome;
}

const noSubscribe = () => () => {};

/** The visitor's device, on the client; "other" while server-rendering. */
export function usePlatform(): Platform {
  return useSyncExternalStore(noSubscribe, detectPlatform, () => "other" as Platform);
}
