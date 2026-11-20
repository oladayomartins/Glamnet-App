/**
 * The loading indicator, everywhere: a spinning circle and a few words.
 *
 * It replaced shape-of-the-page skeletons, which read as a broken page as
 * often as an arriving one. A spinner says one thing only — "your tap
 * worked, the page is on its way".
 *
 * It fades in after a short pause, so a page that arrives quickly never
 * flashes a loader. Under prefers-reduced-motion the global rule stops the
 * spin; the circle and the words still say "loading".
 */

export function Spinner({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={`animate-spin ${className}`}
      style={{ animationDuration: "900ms" }}
    >
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" className="opacity-15" />
      <path d="M24 4a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A whole page loading: the circle, centred where the page will be. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="loader-in flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-accent-500"
    >
      <Spinner size={44} />
      <p className="text-sm font-medium text-ink-muted">{label}…</p>
    </div>
  );
}

/** Something inside a page loading — a list, a calendar, a set of times. */
export function InlineLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="loader-in flex items-center justify-center gap-3 py-8 text-accent-500">
      <Spinner size={24} />
      <span className="text-sm text-ink-muted">{label}…</span>
    </div>
  );
}
