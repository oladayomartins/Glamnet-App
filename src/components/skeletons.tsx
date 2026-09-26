import { Card, Skeleton } from "@/components/ui";

/**
 * Loading states, in the shape of the thing that is loading.
 *
 * Every page here is `force-dynamic` and reads the database before it can send
 * anything, so without these the browser holds the previous screen — or a
 * blank one on a cold navigation — until the query comes back. A skeleton in
 * the right footprint turns that wait into a page that is visibly arriving.
 *
 * Two rules the shapes below follow:
 *
 *  · They reserve the real layout. A skeleton narrower or shorter than what
 *    replaces it makes the page jump at the moment the content lands, which is
 *    worse than the wait it was covering. The page-width markers are repeated
 *    here for the same reason — the shell has to be the width it will be.
 *  · They never invent counts. Three rails of five cards is the shape of the
 *    page, not a claim that five vendors exist; anything that would read as
 *    data — a price, a rating, a number of results — is left out rather than
 *    faked with a plausible-looking bar.
 *
 * The shimmer is one animation, already defined in the token layer, and the
 * global `prefers-reduced-motion` rule stops it dead for anyone who asked for
 * stillness — leaving the grey footprints, which still say "arriving".
 */

/** Wraps a screen's skeleton, so assistive tech is told rather than shown. */
export function LoadingScreen({
  label,
  pageWidth,
  className = "",
  children,
}: {
  label: string;
  pageWidth?: "wide" | "full";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-page-width={pageWidth}
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** The hero band: copy column, booking bar, figures — and the picture. */
export function HeroSkeleton() {
  return (
    <section className="on-light relative bg-[var(--glam-hero-ground)] lg:flex lg:min-h-[37rem] lg:items-center">
      {/* The photograph's own column, matching the live band exactly so the
          band is the height it will be when the page arrives. */}
      <div className="hero-picture pointer-events-none hidden lg:block">
        <Skeleton className="h-full w-full rounded-none" />
        <div
          aria-hidden
          className="hero-fade-wash absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[var(--glam-hero-ground)] from-45% to-transparent"
        />
      </div>

      <div className="relative mx-auto w-full max-w-[var(--glam-page-max)] px-4 pb-7 pt-8 lg:py-8 xl:py-10">
        {/*
          Sized from the live band rather than by eye. On a 390px phone the
          real parts measure: eyebrow 16, headline 85, lede 96, pill 44,
          bar 174, figures 24 — and the bar is the one that changes shape,
          stacking its three controls below `sm` and sitting on one row above.
          A skeleton that kept the desktop bar's height left the phone 175px
          short and the page jumped as the content landed.
        */}
        <div className="max-w-[var(--glam-hero-col)]">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-[85px] w-full max-w-[30rem] sm:h-[96px]" />
          <Skeleton className="mt-5 h-24 w-full max-w-[28rem] sm:h-[72px]" />
        </div>

        <Skeleton className="mt-6 h-11 w-64 rounded-full" />
        <Skeleton className="mt-3 h-[174px] w-full max-w-[var(--glam-hero-col)] rounded-glam sm:h-[4.5rem]" />
        {/* The emergency-threshold line under the bar. Leaving it out is what
            kept the phone 24px short of the real band. */}
        <Skeleton className="mt-2 h-4 w-full max-w-[22rem]" />

        <div className="mt-5 flex h-6 max-w-[var(--glam-hero-col)] flex-wrap items-center gap-x-7 gap-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </section>
  );
}

/** A browse rail: its heading, and a row of tiles at the tiles' own ratio. */
export function RailSkeleton({
  cards = 4,
  aspect = "aspect-[4/3]",
}: {
  cards?: number;
  aspect?: string;
}) {
  return (
    <div className="pt-14 sm:pt-16">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-4 flex gap-3 overflow-hidden">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="w-[220px] shrink-0 sm:w-[250px]">
            <Skeleton className={`${aspect} w-full rounded-glam`} />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A page that opens with a title and a line under it. */
export function PageHeadingSkeleton({ lede = true }: { lede?: boolean }) {
  return (
    <div>
      <Skeleton className="h-7 w-52" />
      {lede ? <Skeleton className="mt-2 h-4 w-72" /> : null}
    </div>
  );
}

/** A list of cards — search offers, bookings, requests. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

/** A dense ledger, inside the card that scrolls it. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-full" />
      <div className="mt-3 space-y-2.5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    </Card>
  );
}

/** Two or three figures side by side, above the detail they summarise. */
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-24" />
          <Skeleton className="mt-1.5 h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

/** A form: a few labelled fields and the button that submits them. */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card className="space-y-4 p-5">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-glam-input" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-full" />
    </Card>
  );
}
