"use client";

import { useEffect, useState } from "react";
import { WifiSlash } from "@phosphor-icons/react";

/**
 * The offline state (§S-02).
 *
 * GLAMNET ships no service worker, so there is no offline cache and nothing
 * keeps working while the connection is down. The copy says exactly that
 * rather than the reassuring version: a customer who believes their booking
 * was saved offline will not re-send it, and the slot will go to somebody
 * else.
 *
 * It is a bar rather than a full-screen takeover because a page already
 * rendered is still readable — it is only new requests that fail.
 */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Read on mount rather than during render: `navigator` does not exist on
    // the server, and the first client paint must match the server's HTML.
    const sync = () => setOffline(!navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-center text-sm text-ink"
    >
      <WifiSlash size={16} weight="light" aria-hidden className="shrink-0" />
      <span>
        You are offline. This page still reads, but nothing will book or save
        until you are back.
      </span>
    </div>
  );
}
