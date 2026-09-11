import type { ReactNode } from "react";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

/**
 * The shared auth layout (§S-01): form left, 4:3 brand image right, stacked on
 * mobile.
 *
 * The image column is hidden below the large breakpoint rather than shrunk.
 * On a phone the form is the whole job, and a decorative panel above it would
 * just push the first field under the fold.
 */
export function AuthLayout({
  title,
  lede,
  children,
  footer,
  reassurance,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer: ReactNode;
  reassurance: string;
}) {
  return (
    <div className="grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">{lede}</p>

        <div className="mt-7">{children}</div>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck size={14} weight="light" aria-hidden />
          {reassurance}
        </p>

        <div className="mt-4 text-sm text-ink-muted">{footer}</div>
      </div>

      {/* The brand panel. Real photography drops into this slot; the ratio is
          fixed now so nothing reflows when it does. */}
      <div
        aria-hidden
        className="hidden aspect-[4/3] w-full rounded-glam-lg bg-metal shadow-raised lg:block"
      />
    </div>
  );
}
