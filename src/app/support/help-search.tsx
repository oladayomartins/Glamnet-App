"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { searchArticles } from "@/lib/domain/help-articles";

/**
 * Search the help articles as you type. The articles are a few kilobytes of
 * text, so they ship with the page and search runs locally — no requests.
 */
export function HelpSearch() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchArticles(query), [query]);
  const searching = query.trim().length > 1;

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search help</span>
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. refund, cancel, PIN, payouts"
          className="min-h-13 w-full rounded-full border border-line bg-surface py-3.5 pl-11 pr-4 text-[15px] text-ink shadow-card outline-none transition duration-[180ms] focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15"
        />
      </label>
      {searching ? (
        <div aria-live="polite" className="mt-3 overflow-hidden rounded-glam border border-line bg-surface">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              No answers match that.{" "}
              <Link href="/support/contact" className="font-semibold text-accent-700">
                Ask us instead
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {results.slice(0, 6).map((article) => (
                <li key={article.slug}>
                  <Link href={`/support/${article.slug}`} className="block px-4 py-3 hover:bg-sunken">
                    <span className="block text-[15px] font-semibold text-ink">{article.title}</span>
                    <span className="block text-sm text-ink-muted">{article.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
