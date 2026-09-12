/**
 * The cycling placeholder used by the booking module's service field.
 *
 * Lives on its own because two things need it to agree: the phrases come from
 * the catalogue, and the rules about when it may move come from the brand
 * guide. Keeping it beside either one would put it out of reach of the other.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

/** How the placeholder is typed out, in milliseconds. */
const TYPE_MS = 55;
const ERASE_MS = 28;
const HOLD_MS = 1800;

/**
 * The cycling placeholder itself.
 *
 * It starts on the FULL first phrase rather than an empty field, so the server
 * and the first client render agree and hydration has nothing to reconcile;
 * the cycle then begins by erasing what is already there.
 *
 * `cycling` is false whenever the field is focused or holds a query, and the
 * phrase snaps to its full self — the customer's own caret is in there, and a
 * word appearing letter by letter beside it looks like a fault, not a hint.
 *
 * Reduced motion switches the animation off entirely and leaves one phrase in
 * place. It is read through `useSyncExternalStore` rather than an effect, so
 * there is no first paint that animates before the preference is noticed.
 */
export function useTypedPlaceholder(hints: string[], cycling: boolean): string {
  const reducedMotion = usePrefersReducedMotion();
  const [frame, setFrame] = useState({
    index: 0,
    typed: hints[0]?.length ?? 0,
    phase: "holding" as "holding" | "erasing" | "typing",
  });

  const animating = cycling && !reducedMotion && hints.length > 1;
  const current = hints[frame.index % Math.max(1, hints.length)] ?? "";

  useEffect(() => {
    if (!animating) return;

    const timer = setTimeout(
      () => {
        setFrame((previous) => {
          const phrase = hints[previous.index % hints.length] ?? "";

          if (previous.phase === "holding") {
            return { ...previous, phase: "erasing" };
          }

          if (previous.phase === "erasing") {
            if (previous.typed > 0) {
              return { ...previous, typed: previous.typed - 1 };
            }
            return {
              index: (previous.index + 1) % hints.length,
              typed: 0,
              phase: "typing",
            };
          }

          if (previous.typed < phrase.length) {
            return { ...previous, typed: previous.typed + 1 };
          }
          return { ...previous, phase: "holding" };
        });
      },
      frame.phase === "holding"
        ? HOLD_MS
        : frame.phase === "erasing"
          ? ERASE_MS
          : TYPE_MS,
    );

    return () => clearTimeout(timer);
  }, [animating, frame, hints]);

  if (hints.length === 0) return "Search for a service";
  if (!animating) return current;
  return current.slice(0, frame.typed);
}

/**
 * Whether the visitor has asked for reduced motion.
 *
 * The server snapshot is `false` because the server cannot know; the value is
 * read synchronously on the client during the first render, so a visitor who
 * has asked for stillness never sees a frame of the animation.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
