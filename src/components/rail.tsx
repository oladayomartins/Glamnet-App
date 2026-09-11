"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * A horizontally scrolling row of cards, with arrows.
 *
 * A rail rather than a wrapping grid because the browse blocks are a glance,
 * not a search: the point is to show that there is more without spending four
 * rows of the page saying so. Search is where a customer goes to see
 * everything, and that is still a grid.
 *
 * The arrows only appear once there is somewhere to go, and each one hides at
 * the end it would scroll past — an arrow that does nothing is worse than no
 * arrow. The row itself stays a native scroll container, so touch, trackpad
 * and keyboard all work without any of this code running.
 */
export function Rail({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  /** Names the region for anyone navigating without sight of it. */
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // A rail that does not overflow is at both ends at once, which is what
    // hides both arrows.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Cards reflow when the window changes, and a rail that fitted at one
    // width may overflow at another.
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const nudge = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // Move by most of a screenful rather than a fixed card width, so the rail
    // does not have to know how wide its children are.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={label}
        className={`rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 ${className}`}
      >
        {children}
      </div>

      <Arrow side="left" hidden={atStart} onClick={() => nudge(-1)} />
      <Arrow side="right" hidden={atEnd} onClick={() => nudge(1)} />
    </div>
  );
}

function Arrow({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll back" : "Scroll on"}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-raised ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-sunken active:scale-[0.98] sm:flex ${
        side === "left" ? "-left-2" : "-right-2"
      }`}
    >
      {side === "left" ? (
        <CaretLeft size={18} weight="light" aria-hidden />
      ) : (
        <CaretRight size={18} weight="light" aria-hidden />
      )}
    </button>
  );
}
