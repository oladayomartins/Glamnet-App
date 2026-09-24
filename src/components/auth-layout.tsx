import type { ReactNode } from "react";
import { LockKey, SealCheck, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { BrandImage } from "@/components/brand-image";
import { CATEGORY_IMAGE_PATHS } from "@/lib/imagekit";

/**
 * The shared auth layout: the form on the left, a brand panel on the right,
 * form only on phones.
 *
 * The panel is a mosaic of the category photography cut into the GLAMNET
 * pin — the same silhouette as the logo — on the champagne-gold metal, with
 * the three promises a new user actually wants to hear before handing over
 * an email address. It is hidden below the large breakpoint rather than
 * shrunk: on a phone the form is the whole job.
 */
export function AuthLayout({
  title,
  lede,
  children,
  footer,
  reassurance,
  eyebrow,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer: ReactNode;
  reassurance: string;
  eyebrow?: string;
}) {
  return (
    <div className="grid gap-10 py-4 lg:min-h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-stretch lg:gap-14">
      <div className="flex items-center">
        <div className="mx-auto w-full max-w-[26rem] py-6">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-accent-700">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] text-ink">
            {title}
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">{lede}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck size={14} weight="light" aria-hidden />
            {reassurance}
          </p>

          <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
            {footer}
          </div>
        </div>
      </div>

      <BrandPanel />
    </div>
  );
}

/** Pin silhouette: round on three corners, pointed on the fourth. */
const PIN = "rounded-[999px_999px_999px_18px]";
const PIN_FLIPPED = "rounded-[999px_999px_18px_999px]";

function BrandPanel() {
  const photos = [
    CATEGORY_IMAGE_PATHS["MUA Glam & Asian Bridal"],
    CATEGORY_IMAGE_PATHS["Afro & Textured"],
    CATEGORY_IMAGE_PATHS["Manicures & Pedicures"],
  ];

  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden rounded-[28px] bg-metal p-8 shadow-raised lg:flex lg:flex-col"
    >
      {/* Light sheen across the metal, top-left, so the panel reads as a
          surface rather than a flat swatch. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(255,255,255,0.35),transparent_70%)]" />

      <div className="relative mx-auto grid w-full max-w-[22rem] flex-1 grid-cols-2 content-center gap-4">
        <Tile shape={PIN} className="translate-y-4">
          <BrandImage path={photos[0]} alt="" width={360} height={420} className="h-full w-full object-cover" />
        </Tile>
        <Tile shape={PIN_FLIPPED} className="bg-obsidian">
          <span className="flex h-full flex-col items-center justify-center gap-2 text-center text-on-obsidian">
            <SealCheck size={34} weight="fill" className="text-[var(--glam-gold)]" />
            <span className="px-3 font-display text-[15px] font-bold leading-tight">Verified pros only</span>
          </span>
        </Tile>
        <Tile shape={PIN_FLIPPED} className="translate-y-4 bg-obsidian">
          <span className="flex h-full flex-col items-center justify-center gap-2 text-center text-on-obsidian">
            <LockKey size={34} weight="fill" className="text-[var(--glam-gold)]" />
            <span className="px-3 font-display text-[15px] font-bold leading-tight">Paid by PIN, when you&rsquo;re happy</span>
          </span>
        </Tile>
        <Tile shape={PIN}>
          <BrandImage path={photos[1]} alt="" width={360} height={420} className="h-full w-full object-cover" />
        </Tile>
        <Tile shape={PIN} className="translate-y-4">
          <BrandImage path={photos[2]} alt="" width={360} height={420} className="h-full w-full object-cover" />
        </Tile>
        <Tile shape={PIN_FLIPPED} className="bg-obsidian">
          <span className="flex h-full flex-col items-center justify-center gap-2 text-center text-on-obsidian">
            <Sparkle size={34} weight="fill" className="text-[var(--glam-gold)]" />
            <span className="px-3 font-display text-[15px] font-bold leading-tight">Hair, glam, nails &amp; wellness</span>
          </span>
        </Tile>
      </div>

      <p className="relative mt-8 text-center font-display text-lg font-bold tracking-[-0.01em] text-metal-ink">
        Sheffield&rsquo;s independent beauty pros, in one place.
      </p>
    </aside>
  );
}

function Tile({
  children,
  shape,
  className = "",
}: {
  children: ReactNode;
  shape: string;
  className?: string;
}) {
  return (
    <div
      className={`aspect-square overflow-hidden shadow-[0_18px_40px_rgba(18,18,18,0.28)] ring-4 ring-white/40 ${shape} ${className}`}
    >
      {children}
    </div>
  );
}
