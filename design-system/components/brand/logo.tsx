import Image from "next/image";
import { cn } from "@/lib/cn";

type PinVariant = "metal" | "obsidian" | "rose";

/**
 * The map pin: "you are here" on proximity maps. It was the logo until v1.3;
 * the logo is now the GN lockup below, and the pin is a map marker only.
 *
 * The teardrop is a square with three round corners and one sharp one, rotated
 * -45°, so it stays optically upright at every size.
 */
export function GlamNetPin({
  size = 32,
  variant = "metal",
  dotClassName,
  className,
}: {
  size?: number;
  variant?: PinVariant;
  /**
   * Overrides the counter dot. The dot normally matches the page ground via
   * `--gn-pin-inner`, so it must be set explicitly whenever the pin sits on a
   * plate that does not follow the theme — the obsidian app-icon tile, say.
   */
  dotClassName?: string;
  className?: string;
}) {
  // Corner radius and dot scale with the pin so the silhouette holds.
  const tail = Math.max(3, Math.round(size * 0.16));
  const dot = Math.round(size * 0.31);

  const surface =
    variant === "metal"
      ? "bg-metal"
      : variant === "obsidian"
        ? "bg-[oklch(0.165_0.008_285)]"
        : "bg-rose";

  const dotColour =
    variant === "obsidian"
      ? "bg-[oklch(0.90_0.05_92)]"
      : variant === "rose"
        ? ""
        : "bg-pin-inner";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        surface,
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: `50% 50% 50% ${tail}px`,
        transform: "rotate(-45deg)",
      }}
    >
      {/* The rose variant is a solid silhouette — no counter dot. */}
      {variant !== "rose" && (
        <div
          className={cn("rounded-full", dotClassName ?? dotColour)}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}

/*
 * The logo artwork lives in public/brand/ as supplied — the foil-gold lockup,
 * a deep-gold cut of it for light grounds, and the GN app-icon tile. These
 * components only place it; never re-draw or re-letter the mark in code.
 * Both lockup files are 1200 × 215.
 */
const LOCKUP_RATIO = 1200 / 215;

/**
 * The foil-gold lockup reads at ~1.9:1 on white, under the 3:1 a logo needs,
 * so a ground that follows the theme gets `adaptive`: the deep-gold cut
 * (~3.6:1 on white) in light mode, the foil gold in dark. A ground that is
 * fixed (an obsidian plate, a cream card) passes `ground` instead.
 */
export function Lockup({
  height = 32,
  ground = "adaptive",
  className,
}: {
  height?: number;
  ground?: "adaptive" | "dark" | "light";
  className?: string;
}) {
  const width = Math.round(height * LOCKUP_RATIO);
  const cut = (src: string, themeClass = "") => (
    <Image
      src={src}
      alt="GLAMNET"
      width={width}
      height={height}
      className={cn("shrink-0", themeClass, className)}
      style={{ width, height }}
    />
  );
  if (ground === "dark") return cut("/brand/glamnet-logo.png");
  if (ground === "light") return cut("/brand/glamnet-logo-on-light.png");
  return (
    <>
      {cut("/brand/glamnet-logo-on-light.png", "gn-logo-light-ground")}
      {cut("/brand/glamnet-logo.png", "gn-logo-dark-ground")}
    </>
  );
}

/** The GN tile on its own: app icon, favicon and avatar fallback. */
export function AppIcon({ size = 42, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/glamnet-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    />
  );
}
