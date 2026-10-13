import Link from "next/link";

export const PAGE_SIZE = 50;

/** The page number in a `?page=` value: 1 for anything missing or odd. */
export function pageFrom(value: string | undefined): number {
  return Math.max(1, Math.floor(Number(value)) || 1);
}

/**
 * Newer / older links under a long admin list, keeping the list's other
 * query parameters. Shows nothing when everything fits on one page.
 */
export function Pager({
  page,
  total,
  pageSize = PAGE_SIZE,
  hrefFor,
  label,
}: {
  page: number;
  total: number;
  pageSize?: number;
  hrefFor: (page: number) => string;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = "inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken";
  return (
    <nav aria-label={label} className="mt-3 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span data-numeric className="text-ink-muted">
        Page {Math.min(page, pages)} of {pages} · {total.toLocaleString("en-GB")} in all
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={link}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** A URL for an admin list, dropping empty and default values. */
export function listHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
