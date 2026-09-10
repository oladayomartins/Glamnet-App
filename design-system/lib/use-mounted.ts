"use client";

import { useSyncExternalStore } from "react";

/** No external store to watch — the value never changes after hydration. */
const subscribe = () => () => {};

/**
 * `false` during server render and the hydration pass, `true` afterwards.
 *
 * `useSyncExternalStore` rather than the usual `useState` + `useEffect` pair,
 * because setting state inside an effect triggers a cascading second render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
