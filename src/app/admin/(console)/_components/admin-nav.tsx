"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Buildings,
  ChartLineUp,
  CalendarCheck,
  ClockCounterClockwise,
  Gear,
  Megaphone,
  Scissors,
  SquaresFour,
  Storefront,
  UsersThree,
  Wallet,
  Television,
  Ticket,
} from "@phosphor-icons/react";

const SECTIONS = [
  { href: "/admin", label: "Overview", icon: SquaresFour },
  { href: "/admin/providers", label: "Vendors", icon: Storefront },
  { href: "/admin/accounts", label: "Accounts", icon: UsersThree },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/catalogue", label: "Categories & services", icon: Scissors },
  { href: "/admin/cities", label: "Cities", icon: Buildings },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/admin/promos", label: "Promo codes", icon: Ticket },
  { href: "/admin/ads", label: "Ad placements", icon: Television },
  { href: "/admin/finance", label: "Finance", icon: Wallet },
  { href: "/admin/activity", label: "Activity log", icon: ClockCounterClockwise },
  { href: "/admin/settings", label: "Settings", icon: Gear },
] as const;

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-700">
        <ChartLineUp size={12} aria-hidden /> Admin console
      </p>
      <p className="mt-1 truncate text-xs text-ink-muted" title={email}>
        {email}
      </p>
      {/* A scrolling chip row on phones, a rail on desktop. */}
      <nav
        aria-label="Admin sections"
        className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {SECTIONS.map(({ href, label, icon: Icon }) => {
          const current = active(href);
          return (
            <Link
              key={href}
              href={href}
              // Each prefetch is a full server render with its own auth check;
              // ten of them on every admin page load is wasted work.
              prefetch={false}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm font-medium transition duration-[180ms] ease-glam lg:rounded-glam-sm ${
                current
                  ? "bg-metal text-metal-ink shadow-card"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink lg:bg-transparent lg:ring-0 lg:hover:bg-sunken"
              }`}
            >
              <Icon size={16} weight={current ? "fill" : "regular"} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
