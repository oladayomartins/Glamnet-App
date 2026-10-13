"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Registers the service worker on every page — not only where notifications
 * are switched on — so the installed app has its offline screen and its icon
 * badge from the first visit. Also clears that badge whenever GLAMNET is
 * opened or brought back to the front: the person is now looking at it.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In development the worker would outlive code changes and confuse
    // reloads; push and install are tested on a production build.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    const clearBadge = () => {
      if (document.visibilityState !== "visible") return;
      (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => undefined);
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
    };
    clearBadge();
    document.addEventListener("visibilitychange", clearBadge);

    const installed = () => track("pwa_installed", {});
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", clearBadge);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  return null;
}
