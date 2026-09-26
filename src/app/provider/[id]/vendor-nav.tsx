"use client";

import { useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarBlank,
  CurrencyGbp,
  House,
  Tray,
  UserCircle,
  type IconProps,
} from "@phosphor-icons/react";

type TabKey = "home" | "requests" | "calendar" | "earnings" | "profile";

interface Tab {
  key: TabKey;
  label: string;
  icon: ComponentType<IconProps>;
  /** A section of the dashboard page, reached by its #anchor. */
  anchor?: string;
  /** A page of its own, relative to /provider/:id. */
  path?: string;
}

const TABS: Tab[] = [
  { key: "home", label: "Home", icon: House, path: "" },
  { key: "requests", label: "Requests", icon: Tray, anchor: "requests" },
  { key: "calendar", label: "Calendar", icon: CalendarBlank, anchor: "calendar" },
  { key: "earnings", label: "Earnings", icon: CurrencyGbp, path: "/earnings" },
  { key: "profile", label: "Profile", icon: UserCircle, path: "/settings" },
];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * The vendor app's navigation: a fixed tab bar along the bottom of a phone
 * screen, where a thumb reaches it and it never scrolls out of sight, and a
 * plain tab row above the page from tablet width up.
 *
 * Requests and Calendar are sections of the dashboard, so on the dashboard
 * they are plain #anchors (a native anchor fires `hashchange`, which is what
 * marks the tab active); from any other vendor page they link back to it.
 */
export function VendorNav({
  providerId,
  placement,
}: {
  providerId: string;
  placement: "top" | "bottom";
}) {
  const pathname = usePathname();
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );

  const base = `/provider/${providerId}`;
  const onDashboard = pathname === base;

  const active: TabKey = onDashboard
    ? hash === "#requests"
      ? "requests"
      : hash === "#calendar"
        ? "calendar"
        : "home"
    : pathname.startsWith(`${base}/earnings`)
      ? "earnings"
      : pathname.startsWith(`${base}/settings`)
        ? "profile"
        : pathname.startsWith(`${base}/availability`)
          ? "calendar"
          : "home";

  const items = TABS.map((tab) => {
    const isActive = tab.key === active;
    const Icon = tab.icon;
    const content =
      placement === "bottom" ? (
        <>
          <Icon size={24} weight={isActive ? "fill" : "regular"} aria-hidden />
          <span>{tab.label}</span>
        </>
      ) : (
        <>
          <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden />
          {tab.label}
        </>
      );

    const className =
      placement === "bottom"
        ? `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition duration-[180ms] ${
            isActive ? "font-bold text-ink" : "font-semibold text-ink-muted"
          }`
        : `inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-[180ms] ${
            isActive ? "bg-ink text-canvas" : "text-ink-muted hover:bg-sunken hover:text-ink"
          }`;

    const current = isActive ? ("page" as const) : undefined;

    // On the dashboard, the dashboard tabs stay on the page: a native anchor
    // scrolls and fires hashchange. "#" for Home returns to the top.
    if (onDashboard && (tab.anchor || tab.path === "")) {
      return (
        <a key={tab.key} href={`#${tab.anchor ?? ""}`} aria-current={current} className={className}>
          {content}
        </a>
      );
    }

    return (
      <Link
        key={tab.key}
        href={tab.anchor ? `${base}#${tab.anchor}` : `${base}${tab.path}`}
        aria-current={current}
        className={className}
      >
        {content}
      </Link>
    );
  });

  if (placement === "bottom") {
    return (
      <nav
        aria-label="Vendor"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {items}
      </nav>
    );
  }

  return (
    <nav aria-label="Vendor" className="mb-6 hidden flex-wrap gap-1 md:flex">
      {items}
    </nav>
  );
}
