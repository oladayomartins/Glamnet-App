"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown, CaretUp, LockKey, Sparkle } from "@phosphor-icons/react";
import { setupBannerCookie } from "@/lib/domain/vendor-setup";

export interface SetupBannerProps {
  providerId: string;
  percent: number;
  live: boolean;
  readyForApproval: boolean;
  /** Unfinished steps, basics first; approval excluded. */
  missing: { key: string; label: string; step: string; requiredToList: boolean }[];
  /** Already formatted; null when nothing is held. */
  heldLabel: string | null;
  /** Collapsed at this exact percentage, read from the cookie on the server. */
  initiallyCollapsed: boolean;
}

/**
 * The setup reminder at the top of every vendor dashboard page: percentage,
 * what's left and any held earnings, the same as the reminder email.
 *
 * Collapsible to one line. The choice is kept in a cookie with the
 * percentage it was made at, so the server renders it collapsed (no flash of
 * the open banner) — and it opens again by itself once the vendor makes
 * progress, so a new percentage is always seen once.
 */
export function SetupBanner(props: SetupBannerProps) {
  const [collapsed, setCollapsed] = useState(props.initiallyCollapsed);
  const left = props.missing.length;
  const shown = props.missing.slice(0, 4);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    const name = setupBannerCookie(props.providerId);
    // A year is plenty; a new percentage reopens it before then anyway.
    document.cookie = next
      ? `${name}=${props.percent}; path=/provider; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      : `${name}=; path=/provider; max-age=0; samesite=lax`;
  };

  const headline = props.readyForApproval
    ? "All done — we're checking your details"
    : props.live
      ? `Your storefront is ${props.percent}% set up`
      : `You're ${props.percent}% of the way to going live`;
  const status = props.readyForApproval
    ? "Your verified badge and payouts follow our approval."
    : props.live
      ? `Live · Not verified · ${left} ${left === 1 ? "step" : "steps"} to your verified badge`
      : `Not live yet · ${left} ${left === 1 ? "step" : "steps"} left`;

  return (
    <section
      aria-label="Finish setting up"
      className="mb-6 overflow-hidden rounded-glam border border-accent-500/40 bg-[radial-gradient(90%_140%_at_0%_0%,color-mix(in_oklab,var(--glam-gold)_16%,transparent),transparent_70%)] bg-surface"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          data-numeric
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 font-display text-sm font-bold text-accent-700"
          aria-hidden
        >
          {props.percent}%
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-ink">{headline}</p>
          <p className="mt-0.5 text-xs leading-snug text-ink-muted">
            {collapsed && props.heldLabel ? `${props.heldLabel} held for you · ` : ""}
            {status}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink-muted transition duration-[180ms] ease-glam hover:bg-sunken hover:text-ink"
        >
          {collapsed ? "Show" : "Hide"}
          {collapsed ? <CaretDown size={14} weight="bold" aria-hidden /> : <CaretUp size={14} weight="bold" aria-hidden />}
        </button>
      </div>

      <div
        className="h-1.5 bg-sunken"
        role="progressbar"
        aria-valuenow={props.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Setup complete"
      >
        <div className="h-full bg-metal transition-[width] duration-[480ms] ease-glam" style={{ width: `${props.percent}%` }} />
      </div>

      {collapsed ? null : (
        <div className="space-y-3 px-4 py-4">
          {props.heldLabel ? (
            <p className="flex items-start gap-2 rounded-glam bg-sunken p-3 text-sm text-ink">
              <LockKey size={16} weight="fill" className="mt-0.5 shrink-0 text-accent-700" aria-hidden />
              <span>
                <strong data-numeric>{props.heldLabel}</strong> earned and kept safe for you. It&rsquo;s paid to your bank
                automatically once you&rsquo;re verified.
              </span>
            </p>
          ) : null}

          {left > 0 ? (
            <>
              <p className="text-sm text-ink-muted">
                {props.live
                  ? "Finish these and we'll check you for your verified badge — clients book verified vendors with more confidence, and that's when your payouts start."
                  : "Finish these and you're listed straight away, so clients can find and book you."}
              </p>
              <ul className="flex flex-wrap gap-2">
                {shown.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={`/provider/onboarding?step=${item.step}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-medium text-ink ring-1 ring-line transition duration-[180ms] ease-glam hover:ring-accent-500"
                    >
                      {item.requiredToList ? <Sparkle size={13} weight="fill" className="text-accent-500" aria-hidden /> : null}
                      {item.label}
                    </Link>
                  </li>
                ))}
                {left > shown.length ? (
                  <li className="inline-flex min-h-10 items-center px-1 text-sm text-ink-muted">+{left - shown.length} more</li>
                ) : null}
              </ul>
              <Link
                href="/provider/onboarding?step=review"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-metal px-5 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105"
              >
                Finish setting up <ArrowRight size={14} weight="bold" aria-hidden />
              </Link>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
