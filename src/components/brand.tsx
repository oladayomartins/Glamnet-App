import Image from "next/image";

/**
 * The GLAMNET lockup: the "GN" tile beside the wordmark, in foil gold on a
 * transparent ground, so it sits on the light surface and the obsidian
 * footer alike. Source files live in public/brand/ — replace them there
 * rather than re-drawing or re-lettering the mark in code.
 */
export function GlamNetLogo({
  height = 28,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  // public/brand/glamnet-logo.png is 1200 × 215.
  const width = Math.round((height * 1200) / 215);
  return (
    <Image
      src="/brand/glamnet-logo.png"
      alt="GLAMNET"
      width={width}
      height={height}
      priority={priority}
      className={`shrink-0 ${className}`}
      style={{ width, height }}
    />
  );
}

/** The "GN" app-icon tile on its own, for places too small for the lockup. */
export function GlamNetMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/glamnet-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}
