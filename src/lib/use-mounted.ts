"use client";

import { useSyncExternalStore } from "react";

/** No external store to watch — the value never changes after hydration. */
const subscribe = () => () => {};

/**
 * `false` during server render and the hydration pass, `true` afterwards.
 *
 * Used where markup must match the server on first paint but depends on
 * client-only state once mounted — the theme toggle, for instance, cannot know
 * which way it switches until next-themes has read the stored preference.
 *
 * This is `useSyncExternalStore` rather than the usual `useState` + `useEffect`
 * because setting state inside an effect triggers a cascading second render
 * (and this repo's lint rules reject it).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
