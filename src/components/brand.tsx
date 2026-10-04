import Image from "next/image";

/**
 * The GLAMNET lockup: the "GN" tile beside the wordmark, in foil gold on a
 * transparent ground. Source files live in public/brand/ — replace them there
 * rather than re-drawing or re-lettering the mark in code.
 *
 * The foil gold is ~1.9:1 against white, under the 3:1 a logo needs, so a
 * surface that turns white in light mode passes `adaptive`: it then also
 * renders the deep-gold cut (glamnet-logo-on-light.png, ~3.6:1 on white) and
 * globals.css shows whichever matches the theme. Grounds that stay dark in
 * both themes, like the obsidian footer, keep the foil gold alone.
 */
export function GlamNetLogo({
  height = 28,
  className = "",
  priority = false,
  adaptive = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
  adaptive?: boolean;
}) {
  // Both files are 1200 × 215.
  const width = Math.round((height * 1200) / 215);
  const logo = (src: string, themeClass: string) => (
    <Image
      src={src}
      alt="GLAMNET"
      width={width}
      height={height}
      priority={priority}
      className={`shrink-0 ${themeClass} ${className}`}
      style={{ width, height }}
    />
  );
  if (!adaptive) return logo("/brand/glamnet-logo.png", "");
  return (
    <>
      {logo("/brand/glamnet-logo-on-light.png", "glam-logo-light-ground")}
      {logo("/brand/glamnet-logo.png", "glam-logo-dark-ground")}
    </>
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
