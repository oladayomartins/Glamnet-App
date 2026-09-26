"use client";

import { useEffect, useState } from "react";

/**
 * Sticky in-page navigation for a long storefront.
 *
 * The problem it solves is entirely a phone problem: a provider page is photos,
 * then a service menu, then reviews, then opening hours, and on a 400px screen
 * that is a lot of thumb. These links jump straight to a section, and the
 * active one is highlighted so the customer can see where they are in the page.
 *
 * Two accessibility details worth keeping:
 *
 *  - the links are real `#anchor` hrefs, so the page still works — and is still
 *    crawlable and shareable — before hydration or with JS off. The observer
 *    below only *decorates*; it is never what makes navigation work.
 *  - `scroll-margin-top` on the targets (set in globals.css) keeps a heading
 *    from landing underneath this bar after a jump.
 */
export interface SectionLink {
  id: string;
  label: string;
}

export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    sections[0]?.id ?? null,
  );

  useEffect(() => {
    // Feature-detect rather than assume: this also runs under test renderers
    // and older browsers, where a missing IntersectionObserver would otherwise
    // throw during render of an otherwise-working page.
    if (typeof IntersectionObserver === "undefined") return;

    // Every target currently inside the band, kept across callbacks.
    //
    // This set is the whole point. An IntersectionObserver callback receives
    // only the entries that *changed*, not everything on screen — so deciding
    // from `entries` alone meant that jumping to Reviews (already
    // intersecting, therefore not in the batch) while About scrolled into the
    // band lit up About. Tracking membership and then choosing the topmost of
    // the full set is what makes the highlight match what the reader sees.
    const onScreen = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }

        const topmost = [...onScreen].sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        )[0];

        // Nothing in the band — between two long sections, say. Keep the last
        // answer rather than clearing it, so the bar never flickers to blank.
        if (topmost) setActiveId(topmost.id);
      },
      // Bias the viewport upward so a section counts as "current" once its
      // heading reaches the top third, not when it first peeks in at the
      // bottom — which is how a reader actually experiences it.
      //
      // The top figure stays below the 72px scroll-margin-top that jump
      // targets use (globals.css): at -88px the section a jump landed on sat
      // inside the excluded strip and never registered at all.
      { rootMargin: "-56px 0px -60% 0px", threshold: 0 },
    );

    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-0 z-20 -mx-4 border-b border-line bg-canvas/95 px-4 backdrop-blur"
    >
      {/* Horizontal scroll rather than wrapping: the bar stays one line tall
          at every width, so it never eats a third of a small screen. */}
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              aria-current={activeId === section.id ? "true" : undefined}
              className={`tap-44 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ease-glam ${
                activeId === section.id
                  ? "bg-ink text-canvas"
                  : "text-ink-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
