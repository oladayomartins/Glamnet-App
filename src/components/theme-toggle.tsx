"use client";

import { useTheme } from "next-themes";
import { CircleHalfTilt } from "@phosphor-icons/react/dist/ssr";
import { useMounted } from "@/lib/use-mounted";

/**
 * Header theme switch.
 *
 * The resolved theme is unknown until after hydration, so the first render must
 * match what the server emitted. Until then the control is hidden from
 * assistive tech rather than announced with the wrong direction — the label and
 * the action always derive from the same value, so they cannot disagree.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = mounted ? `Switch to ${next} mode` : undefined;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      aria-hidden={!mounted}
      title={label}
      className="tap-44 rounded-glam-sm p-2 text-ink-muted transition duration-[180ms] ease-glam hover:bg-brand-50 hover:text-brand-700"
    >
      <CircleHalfTilt size={18} />
    </button>
  );
}
