"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowClockwise,
  CalendarBlank,
  CurrencyGbp,
  House,
  Tray,
  UserCircle,
  type IconProps,
} from "@phosphor-icons/react";
import { requestVendorRefresh, useRequestCountUpdates, useVendorRefresh } from "./vendor-events";

type TabKey = "home" | "requests" | "calendar" | "earnings" | "profile";

const TABS: { key: TabKey; label: string; icon: ComponentType<IconProps>; path: string }[] = [
  { key: "home", label: "Home", icon: House, path: "" },
  { key: "requests", label: "Requests", icon: Tray, path: "/requests" },
  { key: "calendar", label: "Calendar", icon: CalendarBlank, path: "/calendar" },
  { key: "earnings", label: "Earnings", icon: CurrencyGbp, path: "/earnings" },
  { key: "profile", label: "Profile", icon: UserCircle, path: "/settings" },
];

/** How often the tab badge re-counts open requests. */
const COUNT_POLL_MS = 45_000;
/** How far (px) a pull from the top must travel to refresh. */
const PULL_THRESHOLD = 72;

/**
 * The vendor app shell: a tab row above the page from tablet width up, a
 * fixed tab bar along the bottom of a phone screen where a thumb reaches it,
 * a live count of open requests on the Requests tab, and pull-to-refresh.
 */
export function VendorShell({
  providerId,
  children,
}: {
  providerId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/provider/${providerId}`;
  const active = activeTab(pathname, base);
  const requestCount = useRequestCount(providerId);
  const pull = usePullToRefresh();

  const tabs = (placement: "top" | "bottom") =>
    TABS.map((tab) => {
      const isActive = tab.key === active;
      const Icon = tab.icon;
      const badge =
        tab.key === "requests" && requestCount > 0 ? (
          <span
            data-numeric
            className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emergency px-1 text-[11px] font-bold text-on-emergency ${
              placement === "bottom" ? "absolute left-1/2 top-1 ml-1.5" : ""
            }`}
          >
            {requestCount > 9 ? "9+" : requestCount}
          </span>
        ) : null;

      return (
        <Link
          key={tab.key}
          href={`${base}${tab.path}`}
          aria-current={isActive ? "page" : undefined}
          aria-label={
            badge ? `${tab.label}, ${requestCount} open` : undefined
          }
          className={
            placement === "bottom"
              ? `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition duration-[180ms] ${
                  isActive ? "font-bold text-ink" : "font-semibold text-ink-muted"
                }`
              : `inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-[180ms] ${
                  isActive ? "bg-ink text-canvas" : "text-ink-muted hover:bg-sunken hover:text-ink"
                }`
          }
        >
          <Icon
            size={placement === "bottom" ? 24 : 18}
            weight={isActive ? "fill" : "regular"}
            aria-hidden
          />
          {tab.label}
          {badge}
        </Link>
      );
    });

  return (
    <div data-vendor-app className="pb-24 md:pb-0">
      {/* Pull-to-refresh indicator: follows the finger, spins once released. */}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center md:hidden"
        style={{
          opacity: pull.refreshing ? 1 : Math.min(1, pull.distance / PULL_THRESHOLD),
          transform: `translateY(${pull.refreshing ? 16 : Math.min(pull.distance, PULL_THRESHOLD) / 2}px)`,
        }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-card ring-1 ring-line">
          <ArrowClockwise
            size={20}
            aria-hidden
            className={pull.refreshing ? "animate-spin" : ""}
            style={pull.refreshing ? undefined : { transform: `rotate(${pull.distance * 3}deg)` }}
          />
          <span className="sr-only">{pull.refreshing ? "Refreshing" : ""}</span>
        </span>
      </div>

      <nav aria-label="Vendor" className="mb-6 hidden flex-wrap gap-1 md:flex">
        {tabs("top")}
      </nav>

      {children}

      <nav
        aria-label="Vendor"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs("bottom")}
      </nav>
    </div>
  );
}

function activeTab(pathname: string, base: string): TabKey {
  if (pathname.startsWith(`${base}/requests`)) return "requests";
  if (pathname.startsWith(`${base}/calendar`) || pathname.startsWith(`${base}/availability`)) {
    return "calendar";
  }
  if (pathname.startsWith(`${base}/earnings`)) return "earnings";
  if (pathname.startsWith(`${base}/settings`)) return "profile";
  return "home";
}

/**
 * Open requests for the tab badge. Counted on a slow poll and on every
 * refresh, and taken straight from the inbox whenever it loads, so accepting
 * or declining clears the badge at once.
 */
function useRequestCount(providerId: string): number {
  const [count, setCount] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  useRequestCountUpdates(setCount);
  useVendorRefresh(() => setReloadToken((token) => token + 1));

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setReloadToken((token) => token + 1);
    }, COUNT_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/providers/${providerId}/requests`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload && Array.isArray(payload.requests)) setCount(payload.requests.length);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [providerId, reloadToken]);

  return count;
}

/**
 * Pull down from the very top of the page to refresh — the gesture a phone
 * user reaches for, where a Refresh button would scroll out of reach. Reloads
 * the live panels and the server-rendered figures together.
 */
function usePullToRefresh() {
  const router = useRouter();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const current = useRef(0);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      start.current = window.scrollY <= 0 ? event.touches[0].clientY : null;
      current.current = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const pulled = event.touches[0].clientY - start.current;
      // Scrolling back up the page, or not at the top any more: not a pull.
      if (pulled <= 0 || window.scrollY > 0) {
        start.current = null;
        current.current = 0;
        setDistance(0);
        return;
      }
      // Resistance, so the indicator lags the finger like a native pull.
      current.current = pulled * 0.5;
      setDistance(current.current);
    };
    const onEnd = () => {
      if (start.current !== null && current.current >= PULL_THRESHOLD) {
        setRefreshing(true);
        requestVendorRefresh();
        router.refresh();
        window.setTimeout(() => setRefreshing(false), 800);
      }
      start.current = null;
      current.current = 0;
      setDistance(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  return { distance, refreshing };
}
