"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import { AD_SLIDE_SECONDS, deviceClass, type AdDevice } from "@/lib/domain/ad-layout";
import { AdView, type AdViewProps } from "./ad-view";

type Slide = Omit<AdViewProps, "device" | "className" | "preview"> & { slideSeconds: number };

/**
 * Several ads sharing one spot, sliding in turn. Each stays on screen for its
 * own number of seconds, set by an admin.
 *
 * Stops while the pointer or keyboard focus is on it, while the tab is in the
 * background, and for anyone who asked for reduced motion; the pause button
 * stops it for good. Slides off screen are inert, so a keyboard user only
 * tabs to the ad they can see, and an ad's view is only counted once it has
 * slid into view (AdView watches its own visibility).
 */
export function AdCarousel({ ads, device, className = "" }: { ads: Slide[]; device: AdDevice; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchStart = useRef<number | null>(null);
  const count = ads.length;
  const current = Math.min(index, count - 1);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing = !paused && !held && !hidden && !reducedMotion && count > 1;
  const seconds = ads[current]?.slideSeconds ?? AD_SLIDE_SECONDS.default;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, current, seconds, count]);

  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Sponsored"
      className={`${deviceClass(device)} ${className}`.trim()}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div
        className="relative overflow-hidden rounded-glam-lg"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || Math.abs(end - start) < 40) return;
          go(end < start ? current + 1 : current - 1);
        }}
      >
        <div
          aria-live={playing ? "off" : "polite"}
          className={`flex items-start ${reducedMotion ? "" : "transition-transform duration-500 ease-glam"}`}
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {ads.map((ad, slide) => (
            <div
              key={ad.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slide + 1} of ${count}`}
              aria-hidden={slide !== current}
              inert={slide !== current}
              className="w-full shrink-0"
            >
              <AdView {...ad} device="ALL" />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(current - 1)}
          aria-label="Previous ad"
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-obsidian/60 text-on-obsidian transition hover:bg-obsidian/80"
        >
          <CaretLeft size={18} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(current + 1)}
          aria-label="Next ad"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-obsidian/60 text-on-obsidian transition hover:bg-obsidian/80"
        >
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1">
        {!reducedMotion ? (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Play ads" : "Pause ads"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:text-ink"
          >
            {paused ? <Play size={14} weight="fill" aria-hidden /> : <Pause size={14} weight="fill" aria-hidden />}
          </button>
        ) : null}
        {ads.map((ad, slide) => (
          <button
            key={ad.id}
            type="button"
            onClick={() => go(slide)}
            aria-label={`Show ad ${slide + 1} of ${count}`}
            aria-current={slide === current}
            className="flex h-8 w-6 items-center justify-center"
          >
            <span
              aria-hidden
              className={`block h-2 rounded-full transition-all duration-300 ${slide === current ? "w-5 bg-accent-500" : "w-2 bg-line hover:bg-ink-muted"}`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
