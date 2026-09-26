import { Card, Skeleton } from "@/components/ui";

/**
 * Loading states, in the shape of the thing that is loading.
 *
 * For the APP screens only — search, a booking, a dashboard — where the page
 * is `force-dynamic` and reads the database before it can send anything, so
 * without these the browser holds the previous screen until the query comes
 * back. A skeleton in the right footprint turns that wait into a page that is
 * visibly arriving.
 *
 * Marketing and policy pages deliberately have none. They are mostly static,
 * they arrive fast, and a shimmer on a home page or a privacy policy reads as
 * a fault rather than as progress — the page looks broken for the moment
 * before it looks finished.
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
