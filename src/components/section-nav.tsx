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

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently on screen wins. Taking the *first*
        // intersecting entry rather than the most recent one stops the
        // highlight flickering between two sections that are both visible.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      // Bias the viewport upward so a section counts as "current" once its
      // heading reaches the top third, not when it first peeks in at the
      // bottom — which is how a reader actually experiences it.
      { rootMargin: "-88px 0px -66% 0px", threshold: 0 },
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
