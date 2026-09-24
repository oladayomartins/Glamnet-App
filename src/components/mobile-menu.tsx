"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import { ThemeToggle } from "./theme-toggle";

/**
 * The site menu on phones and tablets, where the header has no room for its
 * links. A sheet drops below the header; any link, the backdrop or Escape
 * closes it.
 */
export function MobileMenu({
  links,
  signedIn,
}: {
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="tap-44 flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-sunken"
      >
        {open ? <X size={22} /> : <List size={22} />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="fixed inset-0 top-[var(--glam-header-h,4.25rem)] z-30 bg-obsidian/50 backdrop-blur-[2px]"
          />
          <nav
            id="mobile-menu"
            aria-label="Menu"
            className="rise-in fixed inset-x-0 top-[var(--glam-header-h,4.25rem)] z-40 max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-b border-line bg-surface px-4 pb-6 pt-2 shadow-raised"
          >
            <ul className="divide-y divide-line">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className="flex min-h-14 items-center text-[17px] font-medium text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              {signedIn ? (
                <Link
                  href="/account"
                  onClick={close}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink"
                >
                  My account
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    onClick={close}
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={close}
                    className="inline-flex min-h-12 flex-1 items-center justify-center text-sm font-semibold text-ink"
                  >
                    Sign up
                  </Link>
                </>
              )}
              <ThemeToggle />
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
