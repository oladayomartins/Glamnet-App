"use client";

import { useEffect, useState } from "react";

const ACCEPT_WINDOW_SECONDS = 300;

/**
 * Drives the guide's two live readouts: the map's clock and the provider
 * acceptance countdown.
 *
 * Both start as `null` / the full window so the server-rendered markup is
 * deterministic, then begin ticking after mount. Rendering a real clock during
 * SSR guarantees a hydration mismatch.
 */
export function useTicker() {
  const [clock, setClock] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ACCEPT_WINDOW_SECONDS);

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setSecondsLeft((s) => (s > 0 ? s - 1 : ACCEPT_WINDOW_SECONDS));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return {
    clock,
    secondsLeft,
    /** 0–1 of the acceptance window remaining. */
    acceptProgress: secondsLeft / ACCEPT_WINDOW_SECONDS,
  };
}
