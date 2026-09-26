"use client";

import { useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";

/**
 * The unique landing link generator (Directory §C): the vendor's own
 * glamnet.co/pro/:slug, ready to paste into an Instagram or TikTok bio.
 *
 * Bookings through this link are Rule A — 0% marketplace commission — which
 * is the reason to share it, so the card says so.
 */
export function BioLink({ origin, slug }: { origin: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${origin}/pro/${slug}`;
  const href = `https://${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ url: href, title: "Book me on GLAMNET" }).catch(() => undefined);
    } else {
      await copy();
    }
  };

  return (
    <div className="rounded-glam border border-accent-500/50 bg-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[17px] font-bold text-ink">Your booking link</p>
        <span className="rounded-full bg-metal px-3 py-1 text-xs font-bold text-metal-ink">
          0% commission
        </span>
      </div>
      <p className="mt-2 break-all text-[15px] font-semibold text-ink">{link}</p>
      <p className="mt-1 text-sm text-ink-muted">
        Clients who book through this link pay you with no marketplace commission — only the
        2% card fee. Add it to your Instagram or TikTok bio.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
        >
          {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas"
        >
          <ShareNetwork size={16} weight="bold" />
          Share
        </button>
      </div>
    </div>
  );
}
