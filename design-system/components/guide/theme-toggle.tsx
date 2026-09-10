"use client";

import { useTheme } from "next-themes";
import { CircleHalfTilt } from "@phosphor-icons/react/dist/ssr";
import { useMounted } from "@/lib/use-mounted";

/**
 * Header theme switch. Labelled with the mode it will switch *to*, matching
 * how the guide is read: "Light mode" means tap for light.
 *
 * The theme is unknown until after hydration, so the first render must match
 * what the server emitted — hence the `mounted` gate and the `dark` default,
 * which is the ThemeProvider's default too. Both the visible label and the
 * accessible name derive from the same value so they can never disagree.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const current = mounted ? (resolvedTheme ?? theme ?? "dark") : "dark";
  const next = current === "dark" ? "light" : "dark";
  const label = next === "light" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      // The visual pill is 33px tall by design, so `tap-44` supplies the
      // accessibility floor as an overlay rather than by inflating the padding.
      className="tap-44 flex items-center gap-[7px] rounded-pill border border-line px-3.5 py-2 text-xs font-semibold text-text-1 transition-colors duration-[180ms] ease-gn select-none hover:border-rose"
    >
      <CircleHalfTilt size={15} />
      {label}
    </button>
  );
}
