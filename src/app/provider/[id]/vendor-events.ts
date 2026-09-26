"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * The vendor pages' shared refresh signal. Pull-to-refresh, the refresh
 * button, accepting or declining a request, and coming back to the tab all
 * ask for fresh data the same way, and every live panel on screen (inbox,
 * calendar, tab-bar badge) reloads itself — none of them has to know which
 * others are mounted.
 */
const REFRESH = "glamnet:vendor-refresh";
const REQUEST_COUNT = "glamnet:vendor-request-count";

export function requestVendorRefresh() {
  window.dispatchEvent(new Event(REFRESH));
}

/**
 * Run `onRefresh` whenever a refresh is asked for, and when the vendor comes
 * back to the tab — usually by tapping a request notification, after the
 * page has sat in the background for hours.
 */
export function useVendorRefresh(onRefresh: () => void) {
  const handle = useEffectEvent(onRefresh);

  useEffect(() => {
    const onRequest = () => handle();
    const onVisible = () => {
      if (document.visibilityState === "visible") handle();
    };
    window.addEventListener(REFRESH, onRequest);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(REFRESH, onRequest);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/** The inbox tells the tab bar how many open requests it just loaded. */
export function publishRequestCount(count: number) {
  window.dispatchEvent(new CustomEvent<number>(REQUEST_COUNT, { detail: count }));
}

export function useRequestCountUpdates(onCount: (count: number) => void) {
  const handle = useEffectEvent(onCount);

  useEffect(() => {
    const listener = (event: Event) => handle((event as CustomEvent<number>).detail);
    window.addEventListener(REQUEST_COUNT, listener);
    return () => window.removeEventListener(REQUEST_COUNT, listener);
  }, []);
}
