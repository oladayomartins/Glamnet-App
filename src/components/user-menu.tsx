"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CaretDown,
  MagnifyingGlass,
  ShieldCheck,
  SignOut,
  Storefront,
  UserCircle,
} from "@phosphor-icons/react";

export interface UserMenuProps {
  name: string;
  email: string;
  avatarUrl: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

const ROLE_LABEL = { CUSTOMER: "Client", PROVIDER: "Beauty pro", ADMIN: "Admin" } as const;

/** Each account type's own shortcuts. */
function linksFor(role: UserMenuProps["role"]) {
  if (role === "PROVIDER") {
    return [
      { href: "/provider", label: "My dashboard", icon: CalendarCheck },
      { href: "/provider/onboarding", label: "Edit my storefront", icon: Storefront },
    ];
  }
  if (role === "ADMIN") {
    return [{ href: "/admin", label: "Admin console", icon: ShieldCheck }];
  }
  return [
    { href: "/account", label: "My bookings", icon: CalendarCheck },
    { href: "/account#details", label: "Profile & photo", icon: UserCircle },
    { href: "/search", label: "Book a service", icon: MagnifyingGlass },
  ];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Round profile photo, or gold initials when there is none. */
export function Avatar({ name, url, size }: { name: string; url: string; size: number }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    const px = size * 2;
    // ImageKit crops to the face at the size shown; other URLs are left alone.
    const src = url.includes("imagekit.io") ? `${url}?tr=w-${px},h-${px},fo-face` : url;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a tiny, already-sized avatar
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-metal font-bold text-metal-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * The signed-in person's avatar in the header. Hovering with a mouse opens a
 * card with their details, shortcuts and sign-out; a tap or click toggles it,
 * and Escape or a click elsewhere closes it.
 */
export function UserMenu({ name, email, avatarUrl, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();
  const firstName = name.trim().split(/\s+/)[0] || name;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Hover only for a real mouse: on touch, pointerenter fires just before the
  // click, which would open the menu and then immediately toggle it shut.
  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    // A short grace period so crossing the gap to the card doesn't close it.
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative ml-1" onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        className={`tap-44 flex min-h-10 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 transition ${
          open ? "border-accent-500 bg-sunken" : "border-line bg-surface hover:border-accent-500"
        }`}
      >
        <Avatar name={name} url={avatarUrl} size={32} />
        <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-ink xl:inline">{firstName}</span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="rise-in absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-glam-lg border border-line bg-surface shadow-raised"
        >
          <div className="flex items-center gap-3 border-b border-line bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_oklab,var(--glam-gold)_18%,transparent),transparent_70%)] p-4">
            <Avatar name={name} url={avatarUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate font-display font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-ink-muted">{email}</p>
              <span className="mt-1 inline-flex rounded-full bg-accent-100/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-700">
                {ROLE_LABEL[role]}
              </span>
            </div>
          </div>

          <ul className="py-1.5">
            {linksFor(role).map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={close}
                  className="flex min-h-11 items-center gap-3 px-4 text-sm font-medium text-ink transition hover:bg-sunken"
                >
                  <Icon size={18} aria-hidden className="text-ink-muted" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <form action="/auth/sign-out" method="post" className="border-t border-line p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 rounded-glam-sm px-2.5 text-sm font-semibold text-ink transition hover:bg-sunken"
            >
              <SignOut size={18} aria-hidden className="text-ink-muted" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
